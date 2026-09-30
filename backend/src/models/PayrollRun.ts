import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayrollLine {
  employeeId: Types.ObjectId;
  employeeName: string; // snapshot
  employeeCode: string; // snapshot
  presentDays: number;
  halfDays: number;
  basic: number;
  allowances: number;
  overtime: number;
  bonus: number;
  advanceDeducted: number;
  deductions: number;
  netPay: number;
}

/**
 * A monthly payroll. PENDING → APPROVED (numbers frozen) → PAID (money moved
 * out of a wallet and the salary journal is posted).
 */
export interface IPayrollRun extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  period: string; // "YYYY-MM"
  lines: IPayrollLine[];
  totalNet: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  paidById?: Types.ObjectId | null;
  paidAt?: Date;
  accountId?: Types.ObjectId | null; // wallet salaries were paid from
  journalEntryId?: Types.ObjectId | null;
  notes?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollLineSchema = new Schema<IPayrollLine>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeName: { type: String, required: true },
    employeeCode: { type: String, required: true },
    presentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    advanceDeducted: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
  },
  { _id: false }
);

const PayrollRunSchema = new Schema<IPayrollRun>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    period: { type: String, required: true, match: [/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'] },
    lines: { type: [PayrollLineSchema], required: true },
    totalNet: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    paidById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    journalEntryId: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    notes: { type: String, trim: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'payroll_runs' }
);

PayrollRunSchema.index({ orgId: 1, period: 1 });

export const PayrollRun = mongoose.model<IPayrollRun>('PayrollRun', PayrollRunSchema);
