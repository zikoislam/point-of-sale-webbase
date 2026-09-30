import mongoose, { Document, Schema, Types } from 'mongoose';

export const REPORT_TYPES = [
  'sales',
  'daily-register',
  'top-products',
  'wholesale-vs-retail',
  'category-wise-sales',
  'inventory',
  'inventory-valuation',
  'low-stock',
  'dead-stock',
  'stock-reorder',
  'auto-reorder',
  'expiry',
  'stock-movement-summary',
  'inventory-aging',
  'purchases',
  'supplier-price-comparison',
  'purchase-vs-sales',
  'pnl',
  'dues',
  'payables',
  'agent-payables',
  'lc-status',
  'landed-cost',
  'pending-approvals',
  'project-pnl',
  'wastage',
  'online-vs-offline',
  'fulfillment-rate',
  'lead-conversion',
  'ticket-sla',
  'leave-summary',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

/** Recurrence rules, kept simple enough to explain to a shop owner. */
export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface IScheduledReportRun {
  at: Date;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  recipients: string[];
  attachment?: string;
  error?: string;
  durationMs?: number;
}

/** A recurring report emailed to management (Phase 11.2). */
export interface IScheduledReport extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  reportType: ReportType;
  frequency: Frequency;
  /** HH:mm in the shop's local time (24h). */
  timeOfDay: string;
  /** 0 = Sunday … 6 = Saturday (WEEKLY only). */
  dayOfWeek?: number | null;
  /** 1–28 (MONTHLY only; 28 keeps every month valid). */
  dayOfMonth?: number | null;
  /** How many days back the report window reaches. */
  periodDays: number;
  recipients: string[];
  format: 'PDF' | 'EXCEL';
  extraParams?: Record<string, string>;
  isActive: boolean;
  lastRunAt?: Date | null;
  lastRunStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  lastRunError?: string | null;
  nextRunAt?: Date | null;
  runCount: number;
  history: IScheduledReportRun[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RunSchema = new Schema<IScheduledReportRun>(
  {
    at: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'SKIPPED'], required: true },
    recipients: { type: [String], default: [] },
    attachment: { type: String },
    error: { type: String },
    durationMs: { type: Number },
  },
  { _id: false }
);

const ScheduledReportSchema = new Schema<IScheduledReport>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    reportType: { type: String, enum: REPORT_TYPES, required: true },
    frequency: { type: String, enum: FREQUENCIES, required: true, default: 'DAILY' },
    timeOfDay: {
      type: String,
      required: true,
      default: '08:00',
      validate: {
        validator: (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        message: 'timeOfDay must look like 08:30',
      },
    },
    dayOfWeek: { type: Number, min: 0, max: 6, default: null },
    dayOfMonth: { type: Number, min: 1, max: 28, default: null },
    periodDays: { type: Number, required: true, min: 1, max: 366, default: 1 },
    recipients: {
      type: [String],
      required: true,
      validate: [(v: string[]) => v.length > 0, 'At least one recipient is required'],
    },
    format: { type: String, enum: ['PDF', 'EXCEL'], default: 'PDF', required: true },
    extraParams: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date, default: null },
    lastRunStatus: { type: String, enum: ['SUCCESS', 'FAILED', 'SKIPPED', null], default: null },
    lastRunError: { type: String, default: null },
    nextRunAt: { type: Date, default: null, index: true },
    runCount: { type: Number, default: 0 },
    history: { type: [RunSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'scheduled_reports' }
);

ScheduledReportSchema.index({ orgId: 1, isActive: 1, nextRunAt: 1 });

export const ScheduledReport = mongoose.model<IScheduledReport>('ScheduledReport', ScheduledReportSchema);
