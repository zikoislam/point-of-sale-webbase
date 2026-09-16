import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStockAdjustment extends Document {
  _id: Types.ObjectId;
  variantId: Types.ObjectId; // Ref: products.variants (not strictly ref because it's a subdoc)
  productId: Types.ObjectId; // Ref: products
  type: 'INCREASE' | 'DECREASE';
  quantity: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedById: Types.ObjectId; // Ref: users
  approvedById?: Types.ObjectId; // Ref: users
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustment>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['INCREASE', 'DECREASE'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      required: true,
    },
    requestedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'stock_adjustments',
  }
);

StockAdjustmentSchema.index({ status: 1, createdAt: -1 });
StockAdjustmentSchema.index({ variantId: 1 });

export const StockAdjustment = mongoose.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);
