import mongoose, { Types } from 'mongoose';
import { SalesReturn, ISalesReturn, IReturnItem } from '../models/SalesReturn';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { StoreCreditVoucher } from '../models/StoreCreditVoucher';
import { Shift } from '../models/Shift';
import { StockMovement } from '../models/StockMovement';
import { Customer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { AppError } from '../utils/app-error';

export interface ReturnItemInput {
  variantId: string;
  quantity: number;
  unitRefundPrice: number;
  isResaleable: boolean;
}

export interface ProcessReturnDto {
  saleId: string;
  items: ReturnItemInput[];
  refundType: 'CASH' | 'STORE_CREDIT' | 'CARD_REVERSAL';
  reason: string;
}

async function generateReturnNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RET-${dateStr}-`;
  const last = await SalesReturn.findOne({ returnNo: new RegExp(`^${prefix}`) })
    .sort({ returnNo: -1 })
    .lean();
  let seq = 1;
  if (last) {
    const parts = last.returnNo.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) p1 += chars.charAt(Math.floor(Math.random() * chars.length));
  for (let i = 0; i < 4; i++) p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  return `CR-${p1}-${p2}`;
}

class SalesReturnService {
  async list(page = 1, limit = 20) {
    const [returns, total] = await Promise.all([
      SalesReturn.find()
        .populate('saleId', 'invoiceNo totalAmount')
        .populate('customerId', 'name phone')
        .populate('authorizedById', 'name')
        .populate('voucherId', 'voucherCode currentBalance status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SalesReturn.countDocuments(),
    ]);

    return { data: returns, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid return ID');
    const doc = await SalesReturn.findById(id)
      .populate('saleId')
      .populate('customerId')
      .populate('authorizedById', 'name')
      .populate('voucherId')
      .lean();
    if (!doc) throw new AppError(404, 'RETURN_NOT_FOUND', 'Return record not found');
    return doc;
  }

  async processReturn(dto: ProcessReturnDto, authorizedById: string): Promise<ISalesReturn> {
    if (!Types.ObjectId.isValid(dto.saleId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid sale ID');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new AppError(400, 'EMPTY_ITEMS', 'At least one item must be returned');
    }

    const sale = await Sale.findById(dto.saleId);
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Original sale record not found');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let totalRefundAmount = 0;
      const returnItems: IReturnItem[] = [];

      for (const item of dto.items) {
        const saleItem = sale.items.find((i) => i.variantId.toString() === item.variantId);
        if (!saleItem) {
          throw new AppError(400, 'ITEM_NOT_IN_SALE', `Item not found in invoice ${sale.invoiceNo}`);
        }

        if (item.quantity > saleItem.quantity) {
          throw new AppError(
            400,
            'RETURN_QTY_EXCEEDED',
            `Cannot return more than purchased qty (${saleItem.quantity})`
          );
        }

        const lineRefund = item.quantity * item.unitRefundPrice;
        totalRefundAmount += lineRefund;

        // Restock inventory if resaleable
        if (item.isResaleable) {
          const product = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).session(session);
          if (product) {
            const variant = product.variants.find((v) => v._id.toString() === item.variantId);
            if (variant) {
              const stockBefore = variant.currentStock;
              variant.currentStock += item.quantity;
              const stockAfter = variant.currentStock;

              await product.save({ session });

              await StockMovement.create(
                [
                  {
                    productId: product._id,
                    variantId: variant._id,
                    type: 'RETURN',
                    quantity: item.quantity,
                    stockBefore,
                    stockAfter,
                    unitCost: variant.costPrice,
                    referenceType: 'RETURN',
                    referenceId: sale._id,
                    userId: authorizedById,
                  },
                ],
                { session }
              );
            }
          }
        }

        returnItems.push({
          variantId: new Types.ObjectId(item.variantId),
          quantity: item.quantity,
          unitRefundPrice: item.unitRefundPrice,
          isResaleable: item.isResaleable,
          restocked: item.isResaleable,
        });
      }

      const returnNo = await generateReturnNo();
      let voucherId: Types.ObjectId | undefined = undefined;

      // Handle Refund Disbursement
      if (dto.refundType === 'STORE_CREDIT') {
        if (!sale.customerId) {
          throw new AppError(400, 'CUSTOMER_REQUIRED', 'Store credit requires an associated customer');
        }

        const voucher = await StoreCreditVoucher.create(
          [
            {
              voucherCode: generateVoucherCode(),
              customerId: sale.customerId,
              saleReturnId: new Types.ObjectId(), // placeholder, updated below
              initialBalance: totalRefundAmount,
              currentBalance: totalRefundAmount,
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
              issuedById: new Types.ObjectId(authorizedById),
            },
          ],
          { session }
        );

        voucherId = voucher[0]._id;
      } else if (dto.refundType === 'CASH') {
        // Deduct from active cashier drawer
        const activeShift = await Shift.findOne({
          userId: new Types.ObjectId(authorizedById),
          status: 'OPEN',
        }).session(session);

        if (activeShift) {
          activeShift.cashSalesTotal = Math.max(0, activeShift.cashSalesTotal - totalRefundAmount);
          activeShift.expectedCash = Math.max(0, activeShift.expectedCash - totalRefundAmount);
          await activeShift.save({ session });
        }
      }

      const returnDoc = await SalesReturn.create(
        [
          {
            returnNo,
            saleId: sale._id,
            originalInvoiceNo: sale.invoiceNo,
            customerId: sale.customerId,
            items: returnItems,
            totalRefundAmount,
            refundType: dto.refundType,
            voucherId,
            authorizedById: new Types.ObjectId(authorizedById),
            reason: dto.reason,
          },
        ],
        { session }
      );

      // If voucher was created, link its returnId
      if (voucherId) {
        await StoreCreditVoucher.findByIdAndUpdate(
          voucherId,
          { $set: { saleReturnId: returnDoc[0]._id } },
          { session }
        );
      }

      await session.commitTransaction();
      return returnDoc[0].toObject() as unknown as ISalesReturn;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async validateVoucher(voucherCode: string) {
    const voucher = await StoreCreditVoucher.findOne({ voucherCode: voucherCode.toUpperCase() })
      .populate('customerId', 'name phone')
      .lean();
    if (!voucher) throw new AppError(404, 'VOUCHER_NOT_FOUND', 'Voucher code not found');
    if (voucher.status !== 'ACTIVE') {
      throw new AppError(400, 'VOUCHER_INACTIVE', `Voucher is ${voucher.status.toLowerCase()}`);
    }
    if (new Date() > new Date(voucher.expiresAt)) {
      throw new AppError(400, 'VOUCHER_EXPIRED', 'Voucher has expired');
    }
    return voucher;
  }
}

export const salesReturnService = new SalesReturnService();
