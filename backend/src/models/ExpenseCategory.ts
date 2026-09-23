import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IExpenseCategory extends Document {
  _id: Types.ObjectId;
  name: string; // "Shop Rent", "Electricity", "Staff Lunch", "Wastage Loss"
  code: string;
  /** Ledger head this category posts to; created on first use. */
  accountId?: Types.ObjectId;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'expense_categories',
  }
);

export const ExpenseCategory = mongoose.model<IExpenseCategory>('ExpenseCategory', ExpenseCategorySchema);
