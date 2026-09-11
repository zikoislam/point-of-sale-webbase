import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IExpenseCategory extends Document {
  _id: Types.ObjectId;
  name: string; // "Shop Rent", "Electricity", "Staff Lunch", "Wastage Loss"
  code: string;
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
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'expense_categories',
  }
);

export const ExpenseCategory = mongoose.model<IExpenseCategory>('ExpenseCategory', ExpenseCategorySchema);
