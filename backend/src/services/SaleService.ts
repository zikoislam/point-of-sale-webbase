import mongoose, { Types } from 'mongoose';
import { Sale, ISale, ISaleItem, IPaymentRecord } from '../models/Sale';
import { Product } from '../models/Product';
import { Shift } from '../models/Shift';
import { HoldCart, IHoldCart } from '../models/HoldCart';
import { Customer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';

export interface CartItemDto {
  variantId: string;
  quantity: number;
  unitSellingPrice: number;
  taxRate?: number;
  discount?: number;
}

export interface CheckoutDto {
  customerId?: string;
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: CartItemDto[];
  discountAmount?: number;
  payments: {
    method: 'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD' | 'STORE_CREDIT' | 'CUSTOMER_DUE';
    amount: number;
    transactionRef?: string;
  }[];
  changeReturned?: number;
  idempotencyKey?: string;
}

export interface HoldCartDto {
  cartLabel?: string;
  customerId?: string;
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: CartItemDto[];
  discountAmount?: number;
  notes?: string;
}

async function generateInvoiceNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${dateStr}-`;
  const lastSale = await Sale.findOne({ invoiceNo: new RegExp(`^${prefix}`) })
    .sort({ invoiceNo: -1 })
    .lean();
  let seq = 1;
  if (lastSale) {
    const parts = lastSale.invoiceNo.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

class SaleService {
  async checkout(dto: CheckoutDto, cashierId: string): Promise<ISale> {
    if (!dto.items || dto.items.length === 0) {
      throw new AppError(400, 'EMPTY_CART', 'Cart cannot be empty');
    }

    // Check active shift
    const activeShift = await Shift.findOne({
      userId: new Types.ObjectId(cashierId),
      status: 'OPEN',
    });
    if (!activeShift) {
      throw new AppError(400, 'NO_ACTIVE_SHIFT', 'No active cash register shift. Please open a shift first.');
    }

    // Idempotency check
    const idempotencyKey = dto.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = await Sale.findOne({ idempotencyKey }).lean();
    if (existing) {
      return existing as unknown as ISale;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let subtotal = 0;
      let totalTax = 0;
      const saleItems: ISaleItem[] = [];

      // Validate & deduct stock for each item
      for (const item of dto.items) {
        if (!Types.ObjectId.isValid(item.variantId)) {
          throw new AppError(400, 'INVALID_ID', `Invalid variant ID: ${item.variantId}`);
        }

        const product = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).session(session);
        if (!product || !product.isActive) {
          throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found or inactive`);
        }

        const variant = product.variants.find((v) => v._id.toString() === item.variantId);
        if (!variant || !variant.isAvailable) {
          throw new AppError(404, 'VARIANT_NOT_FOUND', `Variant not available`);
        }

        if (variant.currentStock < item.quantity) {
          throw new AppError(
            400,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for "${product.name} (${variant.attributeName})". Available: ${variant.currentStock}`
          );
        }

        const stockBefore = variant.currentStock;
        variant.currentStock -= item.quantity;
        const stockAfter = variant.currentStock;

        await product.save({ session });

        const taxRate = item.taxRate !== undefined ? item.taxRate : product.taxRate || 0;
        const discount = item.discount || 0;
        const lineGross = item.quantity * item.unitSellingPrice;
        const lineNet = Math.max(0, lineGross - discount);
        const lineTax = product.taxType === 'EXCLUSIVE' ? (lineNet * taxRate) / 100 : 0;
        const lineTotal = lineNet + lineTax;

        subtotal += lineGross;
        totalTax += lineTax;

        saleItems.push({
          variantId: variant._id,
          productName: product.name,
          variantName: variant.attributeName,
          sku: variant.sku,
          barcode: variant.barcode,
          quantity: item.quantity,
          unitCostPrice: variant.costPrice,
          unitSellingPrice: item.unitSellingPrice,
          taxRate,
          taxAmount: lineTax,
          discount,
          lineTotal,
        });

        // Record stock movement
        await StockMovement.create(
          [
            {
              productId: product._id,
              variantId: variant._id,
              type: 'OUT',
              quantity: item.quantity,
              stockBefore,
              stockAfter,
              unitCost: variant.costPrice,
              referenceType: 'SALE',
              referenceId: activeShift._id, // temporarily shift, will update to sale._id if needed
              userId: cashierId,
            },
          ],
          { session }
        );
      }

      const discountAmount = dto.discountAmount || 0;
      const totalAmount = Math.max(0, subtotal + totalTax - discountAmount);

      // Verify payments
      const payments: IPaymentRecord[] = dto.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        transactionRef: p.transactionRef,
      }));

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const duePayment = payments.find((p) => p.method === 'CUSTOMER_DUE');
      const dueAmount = duePayment ? duePayment.amount : 0;
      const changeReturned = Number(dto.changeReturned) || 0;

      // Check Customer Credit if due is used
      if (dueAmount > 0) {
        if (!dto.customerId || !Types.ObjectId.isValid(dto.customerId)) {
          throw new AppError(400, 'CUSTOMER_REQUIRED', 'Customer must be selected for credit / due sales');
        }

        const customer = await Customer.findById(dto.customerId).session(session);
        if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

        const newDueBalance = customer.currentDueBalance + dueAmount;
        if (customer.creditLimit > 0 && newDueBalance > customer.creditLimit) {
          throw new AppError(
            400,
            'CREDIT_LIMIT_EXCEEDED',
            `Credit limit exceeded. Limit: ৳${customer.creditLimit}, New Balance: ৳${newDueBalance}`
          );
        }

        const balanceBefore = customer.currentDueBalance;
        customer.currentDueBalance = newDueBalance;
        await customer.save({ session });

        // Record customer ledger entry
        await CustomerLedger.create(
          [
            {
              customerId: customer._id,
              transactionType: 'SALE_DUE',
              amount: dueAmount,
              balanceBefore,
              balanceAfter: newDueBalance,
              referenceType: 'SALE',
              referenceId: activeShift._id,
              narration: `Credit sale recorded on Shift #${activeShift.terminalId}`,
              recordedById: cashierId,
            },
          ],
          { session }
        );
      }

      const invoiceNo = await generateInvoiceNo();

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
            discountAmount,
            totalAmount,
            paidAmount: totalPaid,
            changeReturned,
            dueAmount,
            payments,
            isOfflineSynced: false,
            idempotencyKey,
          },
        ],
        { session }
      );

      // Accumulate cash in shift
      let cashTendered = 0;
      for (const p of payments) {
        if (p.method === 'CASH') {
          cashTendered += p.amount;
        }
      }
      if (cashTendered > 0) {
        const netCashAdded = Math.max(0, cashTendered - changeReturned);
        activeShift.cashSalesTotal += netCashAdded;
        activeShift.expectedCash += netCashAdded;
        await activeShift.save({ session });
      }

      await session.commitTransaction();
      return sale[0].toObject() as unknown as ISale;
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
      throw new AppError(400, 'NO_ACTIVE_SHIFT', 'No active cash register shift');
    }

    let subtotal = 0;
    const items = [];

    for (const item of dto.items) {
      const product = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).lean();
      if (!product) continue;
      const variant = product.variants.find((v) => v._id.toString() === item.variantId);
      if (!variant) continue;

      const lineTotal = item.quantity * item.unitSellingPrice;
      subtotal += lineTotal;

      items.push({
        variantId: variant._id,
        productName: product.name,
        variantName: variant.attributeName,
        sku: variant.sku,
        barcode: variant.barcode,
        quantity: item.quantity,
        unitSellingPrice: item.unitSellingPrice,
        taxRate: item.taxRate || 0,
        taxAmount: 0,
        discount: item.discount || 0,
        lineTotal,
      });
    }

    const discountAmount = dto.discountAmount || 0;
    const totalAmount = Math.max(0, subtotal - discountAmount);

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

  async resumeCart(id: string): Promise<IHoldCart> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid cart ID');
    const cart = await HoldCart.findByIdAndDelete(id).lean();
    if (!cart) throw new AppError(404, 'CART_NOT_FOUND', 'Hold cart not found or already resumed');
    return cart as unknown as IHoldCart;
  }

  async deleteHoldCart(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid cart ID');
    await HoldCart.findByIdAndDelete(id);
  }

  async getSaleByInvoice(invoiceNo: string): Promise<ISale> {
    const sale = await Sale.findOne({ invoiceNo })
      .populate('cashierId', 'name')
      .populate('customerId', 'name phone')
      .lean();
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale invoice not found');
    return sale as unknown as ISale;
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
        const sale = await this.checkout(dto, cashierId);
        results.push({ success: true, invoiceNo: sale.invoiceNo });
      } catch (err: any) {
        results.push({ success: false, error: err.message, idempotencyKey: dto.idempotencyKey });
      }
    }
    return { synced: results.filter((r) => r.success).length, results };
  }
}

export const saleService = new SaleService();

