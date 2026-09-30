import mongoose, { Types, ClientSession } from 'mongoose';
import { Sale, ISale, ISaleItem, IPaymentRecord } from '../models/Sale';
import { Product } from '../models/Product';
import { Shift } from '../models/Shift';
import { HoldCart, IHoldCart } from '../models/HoldCart';
import { Customer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { StockMovement } from '../models/StockMovement';
import { StoreCreditVoucher } from '../models/StoreCreditVoucher';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { postSaleJournals } from './accounting-postings';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { generateInvoiceNo } from './SequenceService';
import { roundMoney, calculateTax } from '../utils/helpers';
import { PriceTier } from '../models/PriceTier';
import { volumePricingService } from './VolumePricingService';
import { notificationService } from './NotificationService';
import { currentBranchId } from '../middlewares/org.context';
import { loyaltyService } from './LoyaltyService';
import { IVariant } from '../models/Product';

/**
 * Authoritative unit price resolution.
 *
 *  1. A customer with a price tier always buys on that tier (product-level
 *     fixed override first, then retail × (1 − tier discount%)).
 *  2. Otherwise the POS retail/wholesale toggle decides, exactly as before.
 *  3. Volume/trade pricing (quantity based) is applied on top of that price —
 *     a fixed band price wins over a band discount.
 */
async function resolveUnitPrice(
  variant: IVariant,
  pricingTier: 'RETAIL' | 'WHOLESALE',
  customerId?: string,
  session?: ClientSession,
  quantity?: number,
  productId?: string
): Promise<{ price: number; tierId?: Types.ObjectId; volumeDiscountPercent?: number }> {
  let price: number | undefined;
  let tierId: Types.ObjectId | undefined;

  if (customerId && Types.ObjectId.isValid(customerId)) {
    const customer: any = await Customer.findById(customerId).session(session || null).lean();
    if (customer?.priceTierId) {
      const tier: any = await PriceTier.findById(customer.priceTierId).session(session || null).lean();
      if (tier && tier.isActive) {
        const override = (variant.tierPrices || []).find(
          (tp: any) => String(tp.tierId) === String(tier._id)
        );
        if (override) {
          price = roundMoney(override.price);
        } else {
          price = roundMoney(variant.retailSellingPrice * (1 - (tier.discountPercent || 0) / 100));
        }
        tierId = tier._id;
      }
    }
  }

  if (price === undefined) {
    price = roundMoney(pricingTier === 'WHOLESALE' ? variant.wholesaleSellingPrice : variant.retailSellingPrice);
  }

  // Volume / trade pricing — quantity bands defined per product
  let volumeDiscountPercent = 0;
  if (quantity && quantity > 0 && productId) {
    const volume = await volumePricingService.getApplicableDiscount(
      String(productId),
      quantity,
      pricingTier === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      String(variant._id)
    );
    if (volume) {
      if (volume.fixedPrice !== null) {
        price = roundMoney(volume.fixedPrice);
      } else if (volume.discountPercent > 0) {
        price = roundMoney(price * (1 - volume.discountPercent / 100));
      }
      volumeDiscountPercent = volume.discountPercent;
    }
  }

  return { price, tierId, volumeDiscountPercent };
}

export interface CartItemDto {
  variantId: string;
  quantity: number;
  unitSellingPrice: number;
  taxRate?: number;
  discount?: number;
}

export interface PaymentDto {
  method: 'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD' | 'STORE_CREDIT' | 'CUSTOMER_DUE';
  amount: number;
  accountId?: string;
  transactionRef?: string;
}

export interface CheckoutDto {
  customerId?: string;
  pricingTier: 'RETAIL' | 'WHOLESALE';
  /** Field rep attributed with this sale (optional). */
  salesRepId?: string;
  /** Project this revenue belongs to (job costing, Module 7). */
  projectId?: string;
  items: CartItemDto[];
  discountAmount?: number;
  /** Loyalty points the customer is spending on this bill. */
  loyaltyPointsToRedeem?: number;
  payments: PaymentDto[];
  changeReturned?: number;
  idempotencyKey?: string;
  managerPin?: string;
  adminPassword?: string;
}

export interface HoldCartDto {
  cartLabel?: string;
  customerId?: string;
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: CartItemDto[];
  discountAmount?: number;
  notes?: string;
}

const MANAGER_ROLES = ['BRANCH_MANAGER', 'SUPER_ADMIN'];

async function authorizeManagerPin(pin: string, session: ClientSession): Promise<Types.ObjectId> {
  const roles = await Role.find({ name: { $in: MANAGER_ROLES } }).session(session);
  const roleIds = roles.map((r) => r._id);
  const managers = await User.find({ roleId: { $in: roleIds }, isActive: true }).session(session);
  for (const manager of managers) {
    if (await manager.comparePin(pin)) return manager._id;
  }
  throw new AppError(403, 'DISCOUNT_REQUIRES_MANAGER_PIN', 'Invalid manager PIN for discount override');
}

async function authorizeAdminPassword(password: string, session: ClientSession): Promise<Types.ObjectId> {
  const adminRole = await Role.findOne({ name: 'SUPER_ADMIN' }).session(session);
  if (!adminRole) throw new AppError(403, 'DISCOUNT_REQUIRES_MANAGER_PIN', 'No administrator account configured');
  const admins = await User.find({ roleId: adminRole._id, isActive: true }).session(session);
  for (const admin of admins) {
    if (await admin.comparePassword(password)) return admin._id;
  }
  throw new AppError(403, 'DISCOUNT_REQUIRES_MANAGER_PIN', 'Invalid administrator password for discount override');
}

class SaleService {
  async checkout(dto: CheckoutDto, cashierId: string, isOfflineSynced = false): Promise<ISale> {
    if (!dto.items || dto.items.length === 0) {
      throw new AppError(400, 'EMPTY_CART', 'Cart cannot be empty');
    }
    if (!dto.payments || dto.payments.length === 0) {
      throw new AppError(400, 'EMPTY_PAYMENTS', 'At least one payment record is required');
    }

    // Check active shift
    const activeShift = await Shift.findOne({
      userId: new Types.ObjectId(cashierId),
      status: 'OPEN',
    });
    if (!activeShift) {
      throw new AppError(422, 'SHIFT_NOT_ACTIVE', 'No active cash register shift. Please open a shift first.');
    }

    // Idempotency check (the route middleware guarantees a key in production)
    const idempotencyKey =
      dto.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = await Sale.findOne({ idempotencyKey }).lean();
    if (existing) {
      return existing as unknown as ISale;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let subtotal = 0;
      let totalTax = 0;
      let sumLineTotals = 0;
      let totalItemDiscount = 0;
      let activeTierId: Types.ObjectId | undefined;
      const saleItems: ISaleItem[] = [];
      const movementIds: Types.ObjectId[] = [];
      const movementsToCreate: any[] = [];

      // Validate & deduct stock for each item
      for (const item of dto.items) {
        if (!Types.ObjectId.isValid(item.variantId)) {
          throw new AppError(400, 'INVALID_ID', `Invalid variant ID: ${item.variantId}`);
        }
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new AppError(400, 'INVALID_QUANTITY', 'Line quantity must be greater than 0');
        }

        const product = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).session(session);
        if (!product || !product.isActive) {
          throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found or inactive`);
        }

        const variant = product.variants.find((v) => v._id.toString() === item.variantId);
        if (!variant || !variant.isAvailable) {
          throw new AppError(404, 'VARIANT_NOT_FOUND', `Variant not available`);
        }

        // Per-branch availability: when the variant's stock is split across the
        // chain, the branch's own holding is what can be sold (7.1).
        const saleBranchId = currentBranchId();
        const branchEntry = saleBranchId
          ? (variant.branchStock || []).find((e: any) => String(e.branchId) === String(saleBranchId))
          : undefined;
        const availableForBranch = branchEntry ? branchEntry.quantity : variant.currentStock;

        if (!isOfflineSynced && availableForBranch < quantity) {
          throw new AppError(
            422,
            'INSUFFICIENT_INVENTORY',
            `Insufficient stock for "${product.name} (${variant.attributeName})". Available: ${availableForBranch}`
          );
        }

        // Server-side authoritative tier pricing (Rule 2 + configurable tiers + volume bands)
        const { price: tierPrice, tierId } = await resolveUnitPrice(
          variant as unknown as IVariant,
          dto.pricingTier,
          dto.customerId,
          session,
          quantity,
          String(product._id)
        );
        const unitSellingPrice = tierPrice;
        activeTierId = tierId;

        const stockBefore = variant.currentStock;
        variant.currentStock = roundMoney(variant.currentStock - quantity);
        const stockAfter = variant.currentStock;

        // Keep the branch split in step with the sale
        if (branchEntry) {
          branchEntry.quantity = roundMoney(branchEntry.quantity - quantity);
          branchEntry.updatedAt = new Date();
        }

        await product.save({ session });

        const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : product.taxRate || 0;
        const lineDiscount = Math.max(0, Number(item.discount) || 0);
        const lineGross = roundMoney(quantity * unitSellingPrice);
        const lineNet = roundMoney(Math.max(0, lineGross - lineDiscount));
        const lineTax = roundMoney(calculateTax(lineNet, product.taxType, taxRate));
        const lineTotal = roundMoney(
          product.taxType === 'EXCLUSIVE' ? lineNet + lineTax : lineNet
        );

        subtotal = roundMoney(subtotal + lineNet);
        totalTax = roundMoney(totalTax + lineTax);
        sumLineTotals = roundMoney(sumLineTotals + lineTotal);
        totalItemDiscount = roundMoney(totalItemDiscount + lineDiscount);

        saleItems.push({
          variantId: variant._id,
          productName: product.name,
          variantName: variant.attributeName,
          sku: variant.sku,
          barcode: variant.barcode,
          quantity,
          unitCostPrice: variant.costPrice,
          unitSellingPrice,
          taxRate,
          taxAmount: lineTax,
          discount: lineDiscount,
          lineTotal,
        });

        const movementId = new Types.ObjectId();
        movementIds.push(movementId);
        movementsToCreate.push({
          _id: movementId,
          productId: product._id,
          variantId: variant._id,
          type: 'OUT',
          quantity,
          stockBefore,
          stockAfter,
          unitCost: variant.costPrice,
          referenceType: 'SALE',
          referenceId: activeShift._id, // replaced with sale._id below
          userId: cashierId,
        });
      }

      if (movementsToCreate.length > 0) {
        // A cart with several lines produces several movements — Mongoose needs
        // `ordered` explicitly once a session is combined with multiple docs.
        await StockMovement.create(movementsToCreate, { session, ordered: true });
      }

      // Loyalty redemption — points become a bill discount. The programme rules
      // (minimum, per-bill ceiling, balance) all come from the loyalty service.
      let loyaltyRedeemedPoints = 0;
      let loyaltyRedeemedValue = 0;
      if (dto.loyaltyPointsToRedeem && dto.loyaltyPointsToRedeem > 0 && dto.customerId) {
        const points = Math.floor(Number(dto.loyaltyPointsToRedeem));
        const eligibility = await loyaltyService.maxRedeemable(dto.customerId, sumLineTotals, session);
        if (eligibility.config.isActive) {
          if (points < eligibility.minPoints) {
            throw new AppError(
              422,
              'LOYALTY_MIN_REDEEM',
              `A minimum of ${eligibility.minPoints} points is needed to redeem`
            );
          }
          if (points > eligibility.balance) {
            throw new AppError(422, 'LOYALTY_INSUFFICIENT_POINTS', 'The customer does not have enough loyalty points');
          }
          if (points > eligibility.maxPoints) {
            throw new AppError(
              422,
              'LOYALTY_REDEEM_LIMIT',
              `Points can cover at most ${eligibility.config.maxRedeemPercent}% of this bill`
            );
          }
          loyaltyRedeemedPoints = points;
          loyaltyRedeemedValue = roundMoney(points * eligibility.valuePerPoint);
        }
      }

      const billDiscount = roundMoney(Math.max(0, Number(dto.discountAmount) || 0) + loyaltyRedeemedValue);
      const totalAmount = roundMoney(Math.max(0, sumLineTotals - billDiscount));

      // Discount override rules (SECTION 8 Rule 9)
      const discountPercent = subtotal > 0 ? (billDiscount / subtotal) * 100 : 0;
      let overrideAuthorizerId: string | undefined;
      if (discountPercent > 50) {
        if (!dto.adminPassword) {
          throw new AppError(403, 'DISCOUNT_REQUIRES_MANAGER_PIN', 'Discount over 50% requires admin password approval');
        }
        overrideAuthorizerId = (await authorizeAdminPassword(dto.adminPassword, session)).toString();
      } else if (discountPercent > 10) {
        if (!dto.managerPin) {
          throw new AppError(403, 'DISCOUNT_REQUIRES_MANAGER_PIN', 'Discount over 10% requires manager PIN approval');
        }
        overrideAuthorizerId = (await authorizeManagerPin(dto.managerPin, session)).toString();
      }

      // Normalise payments
      const payments: IPaymentRecord[] = dto.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        accountId: p.accountId && Types.ObjectId.isValid(p.accountId) ? new Types.ObjectId(p.accountId) : undefined,
        transactionRef: p.transactionRef,
      }));
      for (const p of payments) {
        if (!Number.isFinite(p.amount) || p.amount < 0) {
          throw new AppError(400, 'INVALID_PAYMENT', 'Payment amount cannot be negative');
        }
      }

      const nonDueTotal = roundMoney(
        payments.filter((p) => p.method !== 'CUSTOMER_DUE').reduce((sum, p) => sum + p.amount, 0)
      );
      const duePayment = payments.find((p) => p.method === 'CUSTOMER_DUE');
      const dueAmount = duePayment ? roundMoney(duePayment.amount) : 0;
      const changeReturned = roundMoney(Math.max(0, Number(dto.changeReturned) || 0));

      if (dueAmount > totalAmount + 0.01) {
        throw new AppError(400, 'OVERPAYMENT', 'Due amount cannot exceed the bill total');
      }
      const netTendered = roundMoney(nonDueTotal - changeReturned);
      if (netTendered + dueAmount + 0.01 < totalAmount) {
        throw new AppError(
          422,
          'INSUFFICIENT_PAYMENT',
          `Payments (৳${netTendered} + ৳${dueAmount} due) do not cover the bill total of ৳${totalAmount}`
        );
      }

      // Credit limit enforcement (Rule 10)
      let customer: any = null;
      let dueBalanceBefore = 0;
      let dueBalanceAfter = 0;
      if (dueAmount > 0) {
        if (!dto.customerId || !Types.ObjectId.isValid(dto.customerId)) {
          throw new AppError(400, 'CUSTOMER_REQUIRED', 'Customer must be selected for credit / due sales');
        }
        customer = await Customer.findById(dto.customerId).session(session);
        if (!customer || !customer.isActive) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

        dueBalanceBefore = customer.currentDueBalance;
        dueBalanceAfter = roundMoney(dueBalanceBefore + dueAmount);
        if (dueBalanceAfter > customer.creditLimit) {
          throw new AppError(
            422,
            'CREDIT_LIMIT_EXCEEDED',
            `Credit limit exceeded. Limit: ৳${customer.creditLimit}, New Balance: ৳${dueBalanceAfter}`
          );
        }
      }

      const invoiceNo = await generateInvoiceNo(session);
      const paidAmount = roundMoney(Math.max(0, totalAmount - dueAmount));

      const sale = await Sale.create(
        [
          {
            invoiceNo,
            shiftId: activeShift._id,
            cashierId: new Types.ObjectId(cashierId),
            customerId: dto.customerId ? new Types.ObjectId(dto.customerId) : undefined,
            pricingTier: dto.pricingTier,
            priceTierId: activeTierId,
            salesRepId: dto.salesRepId && Types.ObjectId.isValid(dto.salesRepId) ? new Types.ObjectId(dto.salesRepId) : undefined,
            projectId: dto.projectId && Types.ObjectId.isValid(dto.projectId)
              ? new Types.ObjectId(dto.projectId)
              : undefined,
            items: saleItems,
            subtotal,
            totalTax,
            discountAmount: roundMoney(billDiscount + totalItemDiscount),
            totalAmount,
            paidAmount,
            changeReturned,
            dueAmount,
            payments,
            isOfflineSynced,
            idempotencyKey,
          },
        ],
        { session }
      );
      const createdSale = sale[0];

      // Link stock movements to the created sale (Rule 3 Step 5)
      if (movementIds.length > 0) {
        await StockMovement.updateMany(
          { _id: { $in: movementIds } },
          { $set: { referenceId: createdSale._id } },
          { session }
        );
      }

      // Customer credit ledger (Rule 3 Step 7)
      if (dueAmount > 0 && customer) {
        customer.currentDueBalance = dueBalanceAfter;
        await customer.save({ session });

        await CustomerLedger.create(
          [
            {
              customerId: customer._id,
              transactionType: 'SALE_DUE',
              amount: dueAmount,
              balanceBefore: dueBalanceBefore,
              balanceAfter: dueBalanceAfter,
              referenceType: 'SALE',
              referenceId: createdSale._id,
              narration: `Credit sale recorded on Invoice ${createdSale.invoiceNo}`,
              recordedById: cashierId,
            },
          ],
          { session }
        );
      }

      // Loyalty: spend the redeemed points, then earn on what was actually paid.
      // Both movements are written to the loyalty ledger so the customer's
      // statement adds up.
      if (dto.customerId) {
        if (loyaltyRedeemedPoints > 0) {
          await loyaltyService.applyRedeem(dto.customerId, String(createdSale._id), loyaltyRedeemedPoints, session);
        }
        await loyaltyService.applyEarn(dto.customerId, String(createdSale._id), totalAmount, session);
      }

      // ── Notifications (bell + live socket) — never block the sale ──────────
      const customerName = customer?.name || (createdSale.customerId ? 'Customer' : null);
      notificationService.notify({
        type: 'NEW_SALE',
        title: `New sale · ৳${totalAmount.toFixed(2)}`,
        message: `${createdSale.invoiceNo}${customerName ? ` to ${customerName}` : ' (walk-in)'} · ${saleItems.length} item(s)`,
        entityType: 'sales',
        entityId: String(createdSale._id),
      });

      // Items that just fell to (or below) their alert quantity
      for (const line of saleItems) {
        const product: any = await Product.findOne({ 'variants._id': line.variantId }).session(session).lean();
        const variant: any = product?.variants?.find((v: any) => String(v._id) === String(line.variantId));
        if (variant && variant.currentStock <= variant.alertQty) {
          notificationService.notify({
            type: 'LOW_STOCK',
            title: 'Low stock alert',
            message: `${product.name} (${variant.attributeName}) is down to ${variant.currentStock} — alert level ${variant.alertQty}`,
            entityType: 'inventory',
            entityId: String(product._id),
          });
        }
      }

      // Customer credit near its limit
      if (dueAmount > 0 && customer && customer.creditLimit > 0) {
        const usedPercent = (dueBalanceAfter / customer.creditLimit) * 100;
        if (usedPercent >= 90) {
          notificationService.notify({
            type: 'DUE_ALERT',
            title: 'Customer credit near limit',
            message: `${customer.name} now owes ৳${dueBalanceAfter.toFixed(2)} of a ৳${customer.creditLimit.toFixed(2)} limit (${usedPercent.toFixed(0)}%)`,
            entityType: 'customers',
            entityId: String(customer._id),
          });
        }
      }

      // Store credit voucher redemption (Rule 3 Step 8)
      for (const p of payments) {
        if (p.method !== 'STORE_CREDIT') continue;
        if (!p.transactionRef) {
          throw new AppError(422, 'VOUCHER_EXHAUSTED_OR_EXPIRED', 'Store credit payment requires a voucher code');
        }
        const voucher = await StoreCreditVoucher.findOneAndUpdate(
          {
            voucherCode: p.transactionRef.toUpperCase().trim(),
            status: 'ACTIVE',
            currentBalance: { $gte: p.amount },
            expiresAt: { $gt: new Date() },
          },
          { $inc: { currentBalance: -p.amount } },
          { new: true, session }
        );
        if (!voucher) {
          throw new AppError(422, 'VOUCHER_EXHAUSTED_OR_EXPIRED', `Voucher ${p.transactionRef} is invalid, expired or has insufficient balance`);
        }
        if (voucher.currentBalance <= 0) {
          voucher.currentBalance = 0;
          voucher.status = 'EXHAUSTED';
          await voucher.save({ session });
        }
      }

      // Double-entry: revenue, VAT, COGS and the wallet side of every payment.
      // The accounting ledger owns Account.currentBalance and mirrors cash
      // movements into account_transactions, so nothing is written by hand here.
      await postSaleJournals(typeof (createdSale as any).toObject === 'function' ? (createdSale as any).toObject() : createdSale, cashierId, session);

      // Accumulate cash in shift
      const cashTendered = roundMoney(
        payments.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0)
      );
      if (cashTendered > 0) {
        const netCashAdded = roundMoney(Math.max(0, cashTendered - changeReturned));
        activeShift.cashSalesTotal = roundMoney(activeShift.cashSalesTotal + netCashAdded);
        activeShift.expectedCash = roundMoney(activeShift.expectedCash + netCashAdded);
        await activeShift.save({ session });
      }

      await session.commitTransaction();

      // Post-commit audit for price override
      if (overrideAuthorizerId) {
        try {
          const { auditService } = await import('./AuditService');
          await auditService.logAction(
            cashierId,
            'PRICE_OVERRIDE',
            'sales',
            createdSale._id.toString(),
            { invoiceNo: createdSale.invoiceNo, discountPercent: roundMoney(discountPercent), authorizedBy: overrideAuthorizerId }
          );
        } catch (err) {
          console.error('Failed to write PRICE_OVERRIDE audit log:', err);
        }
      }

      // Offline oversell alert
      if (isOfflineSynced) {
        const negativeVariants = await Product.find({
          _id: { $in: saleItems.map((i) => i.variantId) },
        })
          .select('name variants')
          .lean();
        for (const prod of negativeVariants) {
          for (const v of prod.variants) {
            if (v.currentStock < 0 && saleItems.some((i) => i.variantId.toString() === v._id.toString())) {
              try {
                const { auditService } = await import('./AuditService');
                await auditService.logAction(
                  cashierId,
                  'OFFLINE_OVERSELL',
                  'sales',
                  createdSale._id.toString(),
                  { invoiceNo: createdSale.invoiceNo, productName: prod.name, sku: v.sku, currentStock: v.currentStock }
                );
                const { emitToRoles } = await import('../sockets');
                emitToRoles('OFFLINE_OVERSELL_ALERT', {
                  invoiceNo: createdSale.invoiceNo,
                  productName: prod.name,
                  sku: v.sku,
                  currentStock: v.currentStock,
                });
              } catch (err) {
                console.error('Failed to emit offline overseer alert:', err);
              }
            }
          }
        }
      }

      return createdSale.toObject() as unknown as ISale;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async holdCart(dto: HoldCartDto, cashierId: string): Promise<IHoldCart> {
    const activeShift = await Shift.findOne({
      userId: new Types.ObjectId(cashierId),
      status: 'OPEN',
    });
    if (!activeShift) {
      throw new AppError(422, 'SHIFT_NOT_ACTIVE', 'No active cash register shift');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new AppError(400, 'EMPTY_CART', 'Cart cannot be empty');
    }

    let subtotal = 0;
    const items = [];

    for (const item of dto.items) {
      if (!Types.ObjectId.isValid(item.variantId)) {
        throw new AppError(400, 'INVALID_ID', `Invalid variant ID: ${item.variantId}`);
      }
      const product = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).lean();
      if (!product) continue;
      const variant = product.variants.find((v) => v._id.toString() === item.variantId);
      if (!variant) continue;

      const unitSellingPrice = (
        await resolveUnitPrice(variant as unknown as IVariant, dto.pricingTier, dto.customerId)
      ).price;
      const quantity = Number(item.quantity);
      const lineTotal = roundMoney(quantity * unitSellingPrice);
      subtotal = roundMoney(subtotal + lineTotal);

      items.push({
        variantId: variant._id,
        productName: product.name,
        variantName: variant.attributeName,
        sku: variant.sku,
        barcode: variant.barcode,
        quantity,
        unitSellingPrice,
        taxRate: item.taxRate || 0,
        taxAmount: 0,
        discount: item.discount || 0,
        lineTotal,
      });
    }

    const discountAmount = Math.max(0, Number(dto.discountAmount) || 0);
    const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount));

    const holdCart = await HoldCart.create({
      cartLabel: dto.cartLabel || `Cart-${Date.now().toString().slice(-4)}`,
      userId: new Types.ObjectId(cashierId),
      shiftId: activeShift._id,
      customerId: dto.customerId ? new Types.ObjectId(dto.customerId) : undefined,
      pricingTier: dto.pricingTier,
      items,
      subtotal,
      discountAmount,
      totalAmount,
      notes: dto.notes,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return holdCart.toObject() as unknown as IHoldCart;
  }

  async listHoldCarts(cashierId: string): Promise<IHoldCart[]> {
    const carts = await HoldCart.find({
      userId: new Types.ObjectId(cashierId),
    })
      .sort({ createdAt: -1 })
      .lean();
    return carts as unknown as IHoldCart[];
  }

  async resumeCart(id: string, cashierId: string): Promise<IHoldCart> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid cart ID');
    const cart = await HoldCart.findByIdAndDelete(id).lean();
    if (!cart) throw new AppError(404, 'CART_NOT_FOUND', 'Hold cart not found or already resumed');
    if (cart.userId.toString() !== cashierId && !(await isManager(cashierId))) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You can only resume your own held carts');
    }
    return cart as unknown as IHoldCart;
  }

  async deleteHoldCart(id: string, cashierId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid cart ID');
    const cart = await HoldCart.findById(id).lean();
    if (!cart) throw new AppError(404, 'CART_NOT_FOUND', 'Hold cart not found');
    if (cart.userId.toString() !== cashierId && !(await isManager(cashierId))) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You can only discard your own held carts');
    }
    await HoldCart.findByIdAndDelete(id);
  }

  async getSaleByInvoice(invoiceNo: string): Promise<ISale> {
    const sale = await Sale.findOne({ invoiceNo })
      .populate('cashierId', 'name fullName')
      .populate('customerId', 'name phone')
      .lean();
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale invoice not found');
    return sale as unknown as ISale;
  }

  /**
   * The A4 wholesale invoice for one sale: letterhead, buyer details (with
   * BIN/TIN), a VAT-per-line item table, tenders received and signature boxes.
   * Returned as a PDF buffer for the counter to print or download.
   */
  async generateWholesaleInvoice(saleId: string): Promise<{ buffer: Buffer; invoiceNo: string }> {
    if (!Types.ObjectId.isValid(saleId)) throw new AppError(400, 'INVALID_ID', 'Invalid sale ID');

    const sale: any = await Sale.findById(saleId)
      .populate('customerId', 'name phone email address taxId customerType creditDays creditLimit currentDueBalance')
      .populate('cashierId', 'fullName username')
      .populate('salesRepId', 'name code')
      .lean();
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found');

    // Imported lazily so the PDF stack never loads on the checkout path.
    const { settingsService } = await import('./SettingsService');
    const { exportService } = await import('./ExportService');

    const shop = await settingsService.getSettings();
    const buffer = await exportService.renderWholesaleInvoice(sale, shop);
    return { buffer, invoiceNo: sale.invoiceNo };
  }

  async listSales(page = 1, limit = 20, filters: { shiftId?: string; customerId?: string; search?: string; cashierId?: string } = {}) {
    const query: any = {};
    if (filters.shiftId && Types.ObjectId.isValid(filters.shiftId)) query.shiftId = new Types.ObjectId(filters.shiftId);
    if (filters.customerId && Types.ObjectId.isValid(filters.customerId))
      query.customerId = new Types.ObjectId(filters.customerId);
    if (filters.cashierId && Types.ObjectId.isValid(filters.cashierId))
      query.cashierId = new Types.ObjectId(filters.cashierId);
    if (filters.search) query.invoiceNo = { $regex: filters.search, $options: 'i' };

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate('cashierId', 'fullName name')
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sale.countDocuments(query),
    ]);

    return { data: sales, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getReceiptData(invoiceNo: string) {
    const sale = await Sale.findOne({ invoiceNo })
      .populate('cashierId', 'name fullName')
      .populate('customerId', 'name phone')
      .lean();
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale invoice not found');

    const { Settings } = await import('../models/Settings');
    const settings = await Settings.findOne({}).lean();

    return {
      shopName: settings?.shopName || 'POS RETAIL STORE',
      shopAddress: settings?.shopAddress,
      shopPhone: settings?.shopPhone,
      invoiceNo: sale.invoiceNo,
      date: new Date(sale.createdAt).toLocaleString(),
      cashierName: (sale.cashierId as any)?.fullName || (sale.cashierId as any)?.name || 'Cashier',
      customerName: (sale.customerId as any)?.name,
      items: sale.items.map((i) => ({
        name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName,
        quantity: i.quantity,
        price: i.unitSellingPrice,
        total: i.lineTotal,
      })),
      subtotal: sale.subtotal,
      tax: sale.totalTax,
      discount: sale.discountAmount,
      grandTotal: sale.totalAmount,
      paidAmount: sale.paidAmount,
      change: sale.changeReturned,
      paymentMethod: sale.payments?.[0]?.method || 'CASH',
      footerText: settings?.receiptFooter,
    };
  }

  async syncOfflineSales(salesBatch: CheckoutDto[], cashierId: string): Promise<{ synced: number; results: any[] }> {
    const results = [];
    for (const dto of salesBatch) {
      try {
        const sale = await this.checkout(dto, cashierId, true);
        results.push({ success: true, invoiceNo: sale.invoiceNo });
      } catch (err: any) {
        results.push({ success: false, error: err.message, idempotencyKey: dto.idempotencyKey });
      }
    }
    return { synced: results.filter((r) => r.success).length, results };
  }
}

async function isManager(userId: string): Promise<boolean> {
  const user = await User.findById(userId).populate<{ roleId: any }>('roleId');
  return !!user && ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.roleId?.name);
}

export const saleService = new SaleService();
