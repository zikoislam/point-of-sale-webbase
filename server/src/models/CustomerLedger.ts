import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomerLedger extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId; // Ref: customers
  transactionType: 'SALE_DUE' | 'PAYMENT_COLLECTION' | 'RETURN_CREDIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'SALE' | 'RECEIPT' | 'RETURN';
  referenceId: Types.ObjectId;
  narration: string;
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
      enum: ['SALE_DUE', 'PAYMENT_COLLECTION', 'RETURN_CREDIT'],
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
      enum: ['SALE', 'RECEIPT', 'RETURN'],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    narration: {
      type: String,
      required: true,
      trim: true,
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
