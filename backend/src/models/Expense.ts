import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IExpense extends Document {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId; // Ref: expense_categories
  amount: number;
  accountId: Types.ObjectId; // Ref: accounts (Debited account)
  receiptVoucherUrl?: string; // Media URL for physical receipt
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: Types.ObjectId; // Ref: users
  rejectionReason?: string;
  createdById: Types.ObjectId; // Ref: users
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    receiptVoucherUrl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
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
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'expenses',
  }
);

// Indexes
ExpenseSchema.index({ categoryId: 1, createdAt: -1 });
ExpenseSchema.index({ accountId: 1, createdAt: -1 });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
