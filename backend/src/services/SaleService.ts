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
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { generateInvoiceNo } from './SequenceService';
import { roundMoney, calculateTax } from '../utils/helpers';

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
  items: CartItemDto[];
  discountAmount?: number;
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

        if (!isOfflineSynced && variant.currentStock < quantity) {
          throw new AppError(
            422,
            'INSUFFICIENT_INVENTORY',
            `Insufficient stock for "${product.name} (${variant.attributeName})". Available: ${variant.currentStock}`
          );
        }

        // Server-side authoritative tier pricing (Rule 2)
        const unitSellingPrice = roundMoney(
          dto.pricingTier === 'WHOLESALE' ? variant.wholesaleSellingPrice : variant.retailSellingPrice
        );

        const stockBefore = variant.currentStock;
        variant.currentStock = roundMoney(variant.currentStock - quantity);
        const stockAfter = variant.currentStock;

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
        await StockMovement.create(movementsToCreate, { session });
      }

      const billDiscount = Math.max(0, Number(dto.discountAmount) || 0);
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

      // Account postings for tendered payments (Rule 3 Step 9)
      for (const p of payments) {
        if (!p.accountId) continue;
        const account = await Account.findById(p.accountId).session(session);
        if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Payment account not found');
        if (!account.isActive) throw new AppError(422, 'ACCOUNT_NOT_ACTIVE', `Account ${account.name} is inactive`);

        const balanceBefore = account.currentBalance;
        const balanceAfter = roundMoney(balanceBefore + p.amount);
        account.currentBalance = balanceAfter;
        await account.save({ session });

        await AccountTransaction.create(
          [
            {
              accountId: account._id,
              type: 'CREDIT',
              amount: p.amount,
              balanceBefore,
              balanceAfter,
              referenceType: 'SALE',
              referenceId: createdSale._id,
              description: `POS sale ${createdSale.invoiceNo} via ${p.method}`,
            },
          ],
          { session }
        );
      }

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

      const unitSellingPrice = roundMoney(
        dto.pricingTier === 'WHOLESALE' ? variant.wholesaleSellingPrice : variant.retailSellingPrice
      );
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

  async listSales(page = 1, limit = 20, filters: { shiftId?: string; customerId?: string; search?: string } = {}) {
    const query: any = {};
    if (filters.shiftId && Types.ObjectId.isValid(filters.shiftId)) query.shiftId = new Types.ObjectId(filters.shiftId);
    if (filters.customerId && Types.ObjectId.isValid(filters.customerId))
      query.customerId = new Types.ObjectId(filters.customerId);
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
    const settings = await Settings.findOne({ isDefault: true }).lean();

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
