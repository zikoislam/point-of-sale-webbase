import mongoose, { Document, Schema, Types } from 'mongoose';

export const LEAVE_TYPES = ['CASUAL', 'SICK', 'ANNUAL', 'UNPAID', 'MATERNITY', 'OTHER'] as const;

/** An employee leave request that a manager approves (Module 9). */
export interface ILeaveRequest extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  requestNo: string; // LV-2026-0001
  employeeId: Types.ObjectId; // Ref: employees
  leaveType: (typeof LEAVE_TYPES)[number];
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  days: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedById?: Types.ObjectId | null;
  decidedAt?: Date | null;
  decisionNote?: string;
  /** Turned into LEAVE attendance rows on approval. */
  attendanceMarked: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    requestNo: { type: String, required: true, trim: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true, default: 'CASUAL' },
    fromDate: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'From date must be YYYY-MM-DD'] },
    toDate: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'To date must be YYYY-MM-DD'] },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500 },
    attendanceMarked: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'leave_requests' }
);

LeaveRequestSchema.index({ orgId: 1, requestNo: 1 }, { unique: true });
LeaveRequestSchema.index({ orgId: 1, employeeId: 1, fromDate: -1 });
LeaveRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const LeaveRequest = mongoose.model<ILeaveRequest>('LeaveRequest', LeaveRequestSchema);
