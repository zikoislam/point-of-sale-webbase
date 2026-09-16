import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomerLedger extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId; // Ref: customers
  transactionType: 'SALE_DUE' | 'PAYMENT_COLLECTION' | 'RETURN_CREDIT' | 'OPENING';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'SALE' | 'RECEIPT' | 'RETURN' | 'OPENING';
  referenceId: Types.ObjectId;
  narration: string;
  /**
   * The day the money actually changed hands, which is not always the day the
   * entry was typed in — a due collected today can belong to yesterday's
   * receipt. Defaults to now when the caller does not supply one.
   */
  transactionDate: Date;
  recordedById: Types.ObjectId; // Ref: users
  createdAt: Date;
}

const CustomerLedgerSchema = new Schema<ICustomerLedger>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    transactionType: {
      type: String,
      enum: ['SALE_DUE', 'PAYMENT_COLLECTION', 'RETURN_CREDIT', 'OPENING'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['SALE', 'RECEIPT', 'RETURN', 'OPENING'],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    narration: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    recordedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'customer_ledgers',
  }
);

// Indexes
CustomerLedgerSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerLedger = mongoose.model<ICustomerLedger>('CustomerLedger', CustomerLedgerSchema);
