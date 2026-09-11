import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReturnItem {
  variantId: Types.ObjectId;
  quantity: number;
  unitRefundPrice: number; // Proportional net refund after discounts
  isResaleable: boolean; // If true -> Stock Restocked; If false -> Wastage
  restocked: boolean;
}

export interface ISalesReturn extends Document {
  _id: Types.ObjectId;
  returnNo: string; // Unique, e.g. "RET-20260907-0001"
  saleId: Types.ObjectId; // Ref: sales
  originalInvoiceNo: string; // Snapshot
  customerId?: Types.ObjectId; // Ref: customers
  items: IReturnItem[];
  totalRefundAmount: number;
  refundType: 'CASH' | 'STORE_CREDIT' | 'CARD_REVERSAL';
  voucherId?: Types.ObjectId; // Ref: store_credit_vouchers
  authorizedById: Types.ObjectId; // Ref: users (Manager PIN)
  reason: string;
  createdAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitRefundPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    isResaleable: {
      type: Boolean,
      required: true,
      default: true,
    },
    restocked: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

const SalesReturnSchema = new Schema<ISalesReturn>(
  {
    returnNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    saleId: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },
    originalInvoiceNo: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    items: {
      type: [ReturnItemSchema],
      required: true,
      validate: [(val: IReturnItem[]) => val.length > 0, 'Return must contain at least one item'],
    },
    totalRefundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundType: {
      type: String,
      enum: ['CASH', 'STORE_CREDIT', 'CARD_REVERSAL'],
      required: true,
    },
    voucherId: {
      type: Schema.Types.ObjectId,
      ref: 'StoreCreditVoucher',
      default: null,
    },
    authorizedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'sales_returns',
  }
);

// Indexes
SalesReturnSchema.index({ saleId: 1, createdAt: -1 });

export const SalesReturn = mongoose.model<ISalesReturn>('SalesReturn', SalesReturnSchema);
