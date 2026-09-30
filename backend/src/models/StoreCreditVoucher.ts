import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStoreCreditVoucher extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  voucherCode: string; // Unique per org, e.g. "CR-89F2-47A1"
  customerId: Types.ObjectId; // Ref: customers
  saleReturnId: Types.ObjectId; // Ref: sales_returns
  initialBalance: number;
  currentBalance: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
  expiresAt: Date; // Typically 1 year from issue
  issuedById: Types.ObjectId; // Ref: users
  createdAt: Date;
  updatedAt: Date;
}

const StoreCreditVoucherSchema = new Schema<IStoreCreditVoucher>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    voucherCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    saleReturnId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesReturn',
      required: true,
    },
    initialBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    currentBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXHAUSTED', 'EXPIRED'],
      default: 'ACTIVE',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    issuedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'store_credit_vouchers',
  }
);

// Indexes
StoreCreditVoucherSchema.index({ orgId: 1, voucherCode: 1 }, { unique: true });
StoreCreditVoucherSchema.index({ customerId: 1, status: 1 });

export const StoreCreditVoucher = mongoose.model<IStoreCreditVoucher>('StoreCreditVoucher', StoreCreditVoucherSchema);
