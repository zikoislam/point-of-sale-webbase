import mongoose, { Types } from 'mongoose';
import { StockAdjustment, IStockAdjustment } from '../models/StockAdjustment';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';

export interface CreateStockAdjustmentDto {
  productId: string;
  variantId: string;
  type: 'INCREASE' | 'DECREASE';
  quantity: number;
  reason: string;
}

class StockAdjustmentService {
  async listAdjustments(page = 1, limit = 20, status?: string) {
    const query: any = {};
    if (status) query.status = status;

    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('requestedById', 'name')
        .populate('approvedById', 'name')
        .populate('productId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockAdjustment.countDocuments(query),
    ]);

    return { data: adjustments, total, page, totalPages: Math.ceil(total / limit) };
  }

  async requestAdjustment(dto: CreateStockAdjustmentDto, userId: string, userRole: string): Promise<IStockAdjustment> {
    if (!Types.ObjectId.isValid(dto.productId) || !Types.ObjectId.isValid(dto.variantId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid product or variant ID');
    }
    
    if (dto.quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be greater than 0');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(dto.productId).session(session);
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      
      const variant = (product.variants as any).id(dto.variantId);
      if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found');

      const isAutoApproved = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
      const status = isAutoApproved ? 'APPROVED' : 'PENDING';

      if (isAutoApproved && dto.type === 'DECREASE') {
        if (variant.stock < dto.quantity) {
          throw new AppError(400, 'INSUFFICIENT_STOCK', `Cannot decrease stock by ${dto.quantity}. Current stock is ${variant.stock}`);
        }
      }

      const adjustment = await StockAdjustment.create(
        [
          {
            productId: new Types.ObjectId(dto.productId),
            variantId: new Types.ObjectId(dto.variantId),
            type: dto.type,
            quantity: dto.quantity,
            reason: dto.reason.trim(),
            status,
            requestedById: new Types.ObjectId(userId),
            ...(isAutoApproved ? { approvedById: new Types.ObjectId(userId) } : {}),
          },
        ],
        { session }
      );

      if (isAutoApproved) {
        const stockBefore = variant.stock;
        const stockAfter = dto.type === 'INCREASE' ? stockBefore + dto.quantity : stockBefore - dto.quantity;
        
        variant.stock = stockAfter;
        await product.save({ session });

        await StockMovement.create(
          [
            {
              productId: product._id,
              variantId: variant._id,
              type: 'ADJUSTMENT',
              quantity: dto.type === 'INCREASE' ? dto.quantity : -dto.quantity,
              stockBefore,
              stockAfter,
              unitCost: variant.costPrice,
              referenceType: 'MANUAL',
              referenceId: adjustment[0]._id,
              reason: dto.reason,
              userId: new Types.ObjectId(userId),
            },
          ],
          { session }
        );
      }

      await session.commitTransaction();
      return adjustment[0].toObject() as unknown as IStockAdjustment;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async approveAdjustment(adjustmentId: string, adminUserId: string, isApproved: boolean, rejectionReason?: string): Promise<IStockAdjustment> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const adjustment = await StockAdjustment.findById(adjustmentId).session(session);
      if (!adjustment) throw new AppError(404, 'ADJUSTMENT_NOT_FOUND', 'Stock adjustment not found');
      if (adjustment.status !== 'PENDING') {
        throw new AppError(400, 'INVALID_STATUS', 'Only pending adjustments can be approved or rejected');
      }

      if (!isApproved) {
        adjustment.status = 'REJECTED';
        adjustment.rejectionReason = rejectionReason;
        adjustment.approvedById = new Types.ObjectId(adminUserId);
        await adjustment.save({ session });
        await session.commitTransaction();
        return adjustment.toObject() as unknown as IStockAdjustment;
      }

      const product = await Product.findById(adjustment.productId).session(session);
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      
      const variant = (product.variants as any).id(adjustment.variantId);
      if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found');

      if (adjustment.type === 'DECREASE' && variant.stock < adjustment.quantity) {
        throw new AppError(400, 'INSUFFICIENT_STOCK', `Cannot decrease stock by ${adjustment.quantity}. Current stock is ${variant.stock}`);
      }

      const stockBefore = variant.stock;
      const stockAfter = adjustment.type === 'INCREASE' ? stockBefore + adjustment.quantity : stockBefore - adjustment.quantity;
      
      variant.stock = stockAfter;
      await product.save({ session });

      adjustment.status = 'APPROVED';
      adjustment.approvedById = new Types.ObjectId(adminUserId);
      await adjustment.save({ session });

      await StockMovement.create(
        [
          {
            productId: product._id,
            variantId: variant._id,
            type: 'ADJUSTMENT',
            quantity: adjustment.type === 'INCREASE' ? adjustment.quantity : -adjustment.quantity,
            stockBefore,
            stockAfter,
            unitCost: variant.costPrice,
            referenceType: 'MANUAL',
            referenceId: adjustment._id,
            reason: adjustment.reason,
            userId: new Types.ObjectId(adminUserId), // Admin who approved
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return adjustment.toObject() as unknown as IStockAdjustment;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const stockAdjustmentService = new StockAdjustmentService();
