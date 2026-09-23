import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAccountTransaction extends Document {
  _id: Types.ObjectId;
  accountId: Types.ObjectId; // Ref: accounts
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType:
    | 'SALE'
    | 'EXPENSE'
    | 'TRANSFER'
    | 'DUE_COLLECTION'
    | 'SUPPLIER_PAYMENT'
    | 'WASTAGE_LOSS'
    | 'RETURN'
    | 'PURCHASE'
    | 'OPENING'
    | 'MANUAL'
    | 'ADJUSTMENT';
  referenceId: Types.ObjectId;
  description: string;
  createdAt: Date;
}

const AccountTransactionSchema = new Schema<IAccountTransaction>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
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
      enum: [
        'SALE',
        'EXPENSE',
        'TRANSFER',
        'DUE_COLLECTION',
        'SUPPLIER_PAYMENT',
        'WASTAGE_LOSS',
        'RETURN',
        'PURCHASE',
        'OPENING',
        'MANUAL',
        'ADJUSTMENT',
      ],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'account_transactions',
  }
);

// Indexes
AccountTransactionSchema.index({ accountId: 1, createdAt: -1 });
AccountTransactionSchema.index({ referenceType: 1, referenceId: 1 });

export const AccountTransaction = mongoose.model<IAccountTransaction>('AccountTransaction', AccountTransactionSchema);
