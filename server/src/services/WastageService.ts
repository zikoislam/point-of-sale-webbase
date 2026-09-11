import mongoose, { Types } from 'mongoose';
import { Product } from '../models/Product';
import { StockMovement, IStockMovement } from '../models/StockMovement';
import { Expense } from '../models/Expense';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { AppError } from '../utils/app-error';

export interface RecordWastageDto {
  variantId: string;
  quantity: number;
  reason: string;
}

class WastageService {
  async recordWastage(dto: RecordWastageDto, userId: string): Promise<IStockMovement> {
    if (!Types.ObjectId.isValid(dto.variantId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid variant ID');
    }
    const qty = Number(dto.quantity);
    if (qty <= 0) throw new AppError(400, 'INVALID_QUANTITY', 'Wastage quantity must be greater than 0');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findOne({ 'variants._id': new Types.ObjectId(dto.variantId) }).session(session);
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

      const variant = product.variants.find((v) => v._id.toString() === dto.variantId);
      if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found');

      if (variant.currentStock < qty) {
        throw new AppError(
          400,
          'INSUFFICIENT_STOCK',
          `Cannot write off ${qty} units. Current stock: ${variant.currentStock}`
        );
      }

      const stockBefore = variant.currentStock;
      variant.currentStock -= qty;
      const stockAfter = variant.currentStock;

      await product.save({ session });

      const lossValuation = parseFloat((qty * variant.costPrice).toFixed(2));

      // 1. Record StockMovement
      const movement = await StockMovement.create(
        [
          {
            productId: product._id,
            variantId: variant._id,
            type: 'WASTAGE',
            quantity: qty,
            stockBefore,
            stockAfter,
            unitCost: variant.costPrice,
            referenceType: 'WASTAGE_EXPENSE',
            referenceId: new Types.ObjectId(),
            reason: dto.reason.trim(),
            userId: new Types.ObjectId(userId),
          },
        ],
        { session }
      );

      // 2. Ensure "WASTAGE_LOSS" ExpenseCategory exists
      let wastageCat = await ExpenseCategory.findOne({ code: 'WASTAGE_LOSS' }).session(session);
      if (!wastageCat) {
        const createdCat = await ExpenseCategory.create(
          [
            {
              name: 'Inventory Wastage & Spoilage',
              code: 'WASTAGE_LOSS',
            },
          ],
          { session }
        );
        wastageCat = createdCat[0];
      }

      // 3. Find primary account or create default for booking the loss
      let account = await Account.findOne().session(session);
      if (account) {
        await Expense.create(
          [
            {
              categoryId: wastageCat._id,
              amount: lossValuation,
              accountId: account._id,
              description: `Damaged/Wastage loss: ${qty}x ${product.name} (${variant.attributeName}). Reason: ${dto.reason}`,
              createdById: new Types.ObjectId(userId),
            },
          ],
          { session }
        );
      }

      await session.commitTransaction();
      return movement[0].toObject() as unknown as IStockMovement;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async listWastages(page = 1, limit = 20) {
    const [movements, total] = await Promise.all([
      StockMovement.find({ type: 'WASTAGE' })
        .populate('productId', 'name unit')
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockMovement.countDocuments({ type: 'WASTAGE' }),
    ]);

    return { data: movements, total, page, totalPages: Math.ceil(total / limit) };
  }
}

export const wastageService = new WastageService();
