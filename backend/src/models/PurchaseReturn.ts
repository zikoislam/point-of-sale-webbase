import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPurchaseReturnItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string; // snapshot
  variantName: string; // snapshot
  sku: string; // snapshot
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
}

/**
 * Goods sent back to a supplier — effectively a Debit Note against the
 * supplier's payable (stock down, payable down, books balanced).
 */
export interface IPurchaseReturn extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  returnNumber: string; // PR-YYYY-XXXX
  purchaseOrderId: Types.ObjectId; // Ref: purchase_orders
  supplierId: Types.ObjectId; // Ref: suppliers
  items: IPurchaseReturnItem[];
  totalAmount: number;
  status: 'DRAFT' | 'CONFIRMED' | 'REFUNDED';
  refundMethod: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_NOTE' | 'ADJUSTED_AGAINST_PAYABLE';
  /** Stock/ledger/journal already posted — the effects run exactly once. */
  effectsApplied: boolean;
  notes?: string;
  createdBy: Types.ObjectId; // Ref: users
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseReturnItemSchema = new Schema<IPurchaseReturnItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    variantName: { type: String, trim: true },
    sku: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const PurchaseReturnSchema = new Schema<IPurchaseReturn>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    returnNumber: { type: String, required: true, trim: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    items: {
      type: [PurchaseReturnItemSchema],
      required: true,
      validate: [(v: IPurchaseReturnItem[]) => v.length > 0, 'A purchase return needs at least one item'],
    },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'CONFIRMED', 'REFUNDED'],
      default: 'CONFIRMED',
      required: true,
      index: true,
    },
    refundMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'CREDIT_NOTE', 'ADJUSTED_AGAINST_PAYABLE'],
      default: 'ADJUSTED_AGAINST_PAYABLE',
      required: true,
    },
    effectsApplied: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'purchase_returns',
  }
);

PurchaseReturnSchema.index({ orgId: 1, returnNumber: 1 }, { unique: true });

export const PurchaseReturn = mongoose.model<IPurchaseReturn>('PurchaseReturn', PurchaseReturnSchema);
