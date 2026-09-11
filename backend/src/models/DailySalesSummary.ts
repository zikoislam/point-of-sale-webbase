import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDailySalesSummary extends Document {
  _id: Types.ObjectId;
  date: string; // "YYYY-MM-DD" (Unique Index)
  totalSalesRevenue: number; // Gross sales turnover
  totalCOGS: number; // Cost of goods sold based on sale-time cost snapshots
  totalTaxCollected: number;
  totalDiscounts: number;
  totalExpenses: number; // Direct shop operating costs
  totalWastageLoss: number; // Cost of written-off damaged goods
  netProfit: number; // Revenue - COGS - Expenses - Wastage
  totalInvoices: number;
  totalItemsSold: number;
  updatedAt: Date;
}

const DailySalesSummarySchema = new Schema<IDailySalesSummary>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    totalSalesRevenue: {
      type: Number,
      required: true,
      default: 0,
    },
    totalCOGS: {
      type: Number,
      required: true,
      default: 0,
    },
    totalTaxCollected: {
      type: Number,
      required: true,
      default: 0,
    },
    totalDiscounts: {
      type: Number,
      required: true,
      default: 0,
    },
    totalExpenses: {
      type: Number,
      required: true,
      default: 0,
    },
    totalWastageLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    netProfit: {
      type: Number,
      required: true,
      default: 0,
    },
    totalInvoices: {
      type: Number,
      required: true,
      default: 0,
    },
    totalItemsSold: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
    collection: 'daily_sales_summaries',
  }
);

export const DailySalesSummary = mongoose.model<IDailySalesSummary>('DailySalesSummary', DailySalesSummarySchema);
