import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IShift extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Ref: users (Cashier)
  terminalId: string; // Counter identifier (e.g. "COUNTER-01")
  openedAt: Date;
  closedAt?: Date;
  openingFloat: number; // Initial cash drawer float
  cashSalesTotal: number; // Accumulated cash collected
  cashExpensesTotal: number; // Cash paid out from drawer
  pettyCashIn: number; // Added mid-shift cash
  pettyCashOut: number; // Drop/draw mid-shift cash
  expectedCash: number; // Opening + Sales + In - Expenses - Out
  actualCash?: number; // Blind physical count by cashier
  discrepancy?: number; // actualCash - expectedCash
  managerApprovalId?: Types.ObjectId; // Ref: users (If discrepancy requires approval)
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    terminalId: {
      type: String,
      required: true,
      trim: true,
      default: 'COUNTER-01',
    },
    openedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    closedAt: {
      type: Date,
    },
    openingFloat: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cashSalesTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cashExpensesTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    pettyCashIn: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    pettyCashOut: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    expectedCash: {
      type: Number,
      required: true,
      default: 0,
    },
    actualCash: {
      type: Number,
    },
    discrepancy: {
      type: Number,
    },
    managerApprovalId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'shifts',
  }
);

// Indexes
ShiftSchema.index({ userId: 1, status: 1, openedAt: -1 });

export const Shift = mongoose.model<IShift>('Shift', ShiftSchema);
