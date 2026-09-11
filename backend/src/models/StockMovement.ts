import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStockMovement extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId; // Ref: products
  variantId: Types.ObjectId; // Subdoc _id in products.variants
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'WASTAGE';
  quantity: number; // Decimal support for fractional units (e.g. 2.5 Goj, 1.75 Meter)
  stockBefore: number;
  stockAfter: number;
  unitCost: number; // Valuation cost at movement time
  referenceType: 'SALE' | 'PO' | 'MANUAL' | 'RETURN' | 'WASTAGE_EXPENSE';
  referenceId: Types.ObjectId;
  reason?: string;
  userId: Types.ObjectId; // Ref: users
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    type: {
      type: String,
      enum: ['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'WASTAGE'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    stockBefore: {
      type: Number,
      required: true,
    },
    stockAfter: {
      type: Number,
      required: true,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceType: {
      type: String,
      enum: ['SALE', 'PO', 'MANUAL', 'RETURN', 'WASTAGE_EXPENSE'],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'stock_movements',
  }
);

// Indexes
StockMovementSchema.index({ variantId: 1, createdAt: -1 });
StockMovementSchema.index({ referenceType: 1, referenceId: 1 });

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
