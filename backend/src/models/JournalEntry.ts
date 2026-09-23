import mongoose, { Document, Schema, Types } from 'mongoose';

/** What produced a voucher — used for filtering and for idempotency. */
export const JOURNAL_SOURCES = [
  'OPENING',
  'SALE',
  'SALE_RETURN',
  'PURCHASE',
  'PURCHASE_RETURN',
  'EXPENSE',
  'WASTAGE',
  'TRANSFER',
  'DUE_COLLECTION',
  'SUPPLIER_PAYMENT',
  'SHIFT',
  'MANUAL',
  'ADJUSTMENT',
  'BACKFILL',
  'YEAR_CLOSE',
] as const;

export type JournalSource = (typeof JOURNAL_SOURCES)[number];

export interface IJournalLine {
  accountId: Types.ObjectId;
  /** Snapshots — a renamed or deleted head must not rewrite history. */
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface IJournalEntry extends Document {
  _id: Types.ObjectId;
  entryNo: string;
  date: Date;
  narration: string;
  source: JournalSource;
  referenceType?: string;
  referenceId?: Types.ObjectId;
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  /** Anything posted outside the normal flow (backfill, reconciliation). */
  isSystemGenerated: boolean;
  isReversed: boolean;
  reversalOf?: Types.ObjectId;
  reversedBy?: Types.ObjectId;
  createdById: Types.ObjectId;
  postedAt: Date;
  createdAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    accountCode: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, default: '' },
    debit: { type: Number, required: true, default: 0, min: 0 },
    credit: { type: Number, required: true, default: 0, min: 0 },
    memo: { type: String, trim: true },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    entryNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    narration: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: JOURNAL_SOURCES,
      required: true,
    },
    referenceType: { type: String, trim: true },
    referenceId: { type: Schema.Types.ObjectId },
    lines: {
      type: [JournalLineSchema],
      required: true,
    },
    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },
    isSystemGenerated: { type: Boolean, default: false },
    isReversed: { type: Boolean, default: false },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    postedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'journal_entries',
  }
);

// Indexes
JournalEntrySchema.index({ date: -1 });
JournalEntrySchema.index({ source: 1, referenceId: 1 });
JournalEntrySchema.index({ 'lines.accountId': 1, date: -1 });
JournalEntrySchema.index({ isReversed: 1 });

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);
