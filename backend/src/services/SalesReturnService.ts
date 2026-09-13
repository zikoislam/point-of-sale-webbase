import mongoose, { Types, ClientSession } from 'mongoose';
import { SalesReturn, ISalesReturn, IReturnItem } from '../models/SalesReturn';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { StoreCreditVoucher } from '../models/StoreCreditVoucher';
import { Shift } from '../models/Shift';
import { StockMovement } from '../models/StockMovement';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { Expense } from '../models/Expense';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { generateReturnNo } from './SequenceService';
import { roundMoney } from '../utils/helpers';

export interface ReturnItemInput {
  variantId: string;
  quantity: number;
  unitRefundPrice?: number;
  isResaleable: boolean;
}

export interface ProcessReturnDto {
  saleId: string;
  items: ReturnItemInput[];
  refundType: 'CASH' | 'STORE_CREDIT' | 'CARD_REVERSAL';
  reason: string;
  managerPin: string;
}

const MANAGER_ROLES = ['BRANCH_MANAGER', 'SUPER_ADMIN'];

async function verifyManagerPin(pin: string, session: ClientSession): Promise<Types.ObjectId> {
  const roles = await Role.find({ name: { $in: MANAGER_ROLES } }).session(session);
  const managers = await User.find({ roleId: { $in: roles.map((r) => r._id) }, isActive: true }).session(session);
  for (const manager of managers) {
    if (await manager.comparePin(pin)) return manager._id;
  }
  throw new AppError(401, 'PIN_INVALID', 'Invalid manager PIN');
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
    if (!dto.managerPin) {
      throw new AppError(403, 'DISCOUNT_REQUIRES_MANAGER_PIN', 'Manager PIN is required to authorise a return');
    }

    const sale = await Sale.findById(dto.saleId);
    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Original sale record not found');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Rule 5 Step 1: verify Manager PIN
      await verifyManagerPin(dto.managerPin, session);

      let totalRefundAmount = 0;
      const returnItems: IReturnItem[] = [];
      const netBillValue = Math.max(0, sale.totalAmount - sale.discountAmount);

      for (const item of dto.items) {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new AppError(400, 'INVALID_QUANTITY', 'Return quantity must be greater than 0');
        }

        const saleItem = sale.items.find((i) => i.variantId.toString() === item.variantId);
        if (!saleItem) {
          throw new AppError(400, 'PROPORTIONAL_REFUND_ERROR', `Item not found in invoice ${sale.invoiceNo}`);
        }

        if (quantity > saleItem.quantity) {
          throw new AppError(
            400,
            'PROPORTIONAL_REFUND_ERROR',
            `Cannot return more than purchased qty (${saleItem.quantity})`
          );
        }

        // Rule 5 Step 3: proportional refund after bill-level discount apportionment
        const lineRefund =
          sale.subtotal > 0
            ? roundMoney(((saleItem.unitSellingPrice * quantity) / sale.subtotal) * netBillValue)
            : roundMoney(saleItem.unitSellingPrice * quantity);
        const unitRefundPrice = roundMoney(lineRefund / quantity);
        totalRefundAmount = roundMoney(totalRefundAmount + lineRefund);

        const product = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).session(session);
        if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found for variant ${item.variantId}`);
        const variant = product.variants.find((v) => v._id.toString() === item.variantId);
        if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', `Variant not found`);

        if (item.isResaleable) {
          // Restock inventory
          const stockBefore = variant.currentStock;
          variant.currentStock = roundMoney(variant.currentStock + quantity);
          const stockAfter = variant.currentStock;
          await product.save({ session });

          await StockMovement.create(
            [
              {
                productId: product._id,
                variantId: variant._id,
                type: 'RETURN',
                quantity,
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
        } else {
          // Rule 5 Step 4: non-resaleable -> wastage expense + account debit
          const lossValuation = roundMoney(quantity * variant.costPrice);
          if (lossValuation > 0) {
            let wastageCat = await ExpenseCategory.findOne({ code: 'WASTAGE_LOSS' }).session(session);
            if (!wastageCat) {
              const createdCat = await ExpenseCategory.create(
                [{ name: 'Inventory Shrinkage & Loss', code: 'WASTAGE_LOSS' }],
                { session }
              );
              wastageCat = createdCat[0];
            }
            const account =
              (await Account.findOne({ accountType: 'CASH', isActive: true }).session(session)) ||
              (await Account.findOne({ isActive: true }).session(session));
            if (!account) {
              throw new AppError(422, 'ACCOUNT_NOT_FOUND', 'No active account available to book the return wastage');
            }

            await Expense.create(
              [
                {
                  categoryId: wastageCat._id,
                  amount: lossValuation,
                  accountId: account._id,
                  description: `Non-resaleable return from ${sale.invoiceNo}: ${quantity}x ${product.name} (${variant.attributeName})`,
                  createdById: new Types.ObjectId(authorizedById),
                },
              ],
              { session }
            );

            const balanceBefore = account.currentBalance;
            const balanceAfter = roundMoney(balanceBefore - lossValuation);
            account.currentBalance = balanceAfter;
            await account.save({ session });

            await AccountTransaction.create(
              [
                {
                  accountId: account._id,
                  type: 'DEBIT',
                  amount: lossValuation,
                  balanceBefore,
                  balanceAfter,
                  referenceType: 'WASTAGE_LOSS',
                  referenceId: sale._id,
                  description: `Non-resaleable return wastage: ${sale.invoiceNo}`,
                },
              ],
              { session }
            );
          }
        }

        returnItems.push({
          variantId: new Types.ObjectId(item.variantId),
          quantity,
          unitRefundPrice,
          isResaleable: item.isResaleable,
          restocked: item.isResaleable,
        });
      }

      const returnNo = await generateReturnNo(session);
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
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              issuedById: new Types.ObjectId(authorizedById),
            },
          ],
          { session }
        );

        voucherId = voucher[0]._id;
      } else if (dto.refundType === 'CASH') {
        // Debit the cash account and record a ledger entry
        const account =
          (await Account.findOne({ accountType: 'CASH', isActive: true }).session(session)) ||
          (await Account.findOne({ isActive: true }).session(session));
        if (account) {
          const balanceBefore = account.currentBalance;
          const balanceAfter = roundMoney(balanceBefore - totalRefundAmount);
          account.currentBalance = balanceAfter;
          await account.save({ session });

          await AccountTransaction.create(
            [
              {
                accountId: account._id,
                type: 'DEBIT',
                amount: totalRefundAmount,
                balanceBefore,
                balanceAfter,
                referenceType: 'RETURN',
                referenceId: sale._id,
                description: `Cash refund for ${sale.invoiceNo}`,
              },
            ],
            { session }
          );
        }

        // Reduce the processing cashier's active drawer
        const activeShift = await Shift.findOne({
          userId: new Types.ObjectId(authorizedById),
          status: 'OPEN',
        }).session(session);
        if (activeShift) {
          activeShift.cashSalesTotal = roundMoney(Math.max(0, activeShift.cashSalesTotal - totalRefundAmount));
          activeShift.expectedCash = roundMoney(Math.max(0, activeShift.expectedCash - totalRefundAmount));
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

      const result: any = returnDoc[0].toObject();
      if (voucherId) {
        const voucher = await StoreCreditVoucher.findById(voucherId).lean();
        if (voucher) result.voucher = { code: voucher.voucherCode, balance: voucher.initialBalance };
      }
      return result;
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
      throw new AppError(422, 'VOUCHER_EXHAUSTED_OR_EXPIRED', `Voucher is ${voucher.status.toLowerCase()}`);
    }
    if (new Date() > new Date(voucher.expiresAt)) {
      throw new AppError(422, 'VOUCHER_EXHAUSTED_OR_EXPIRED', 'Voucher has expired');
    }
    return voucher;
  }
}

export const salesReturnService = new SalesReturnService();
