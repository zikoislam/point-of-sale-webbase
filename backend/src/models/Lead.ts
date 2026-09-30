import mongoose, { Document, Schema, Types } from 'mongoose';

export const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;
export const LEAD_SOURCES = ['WALK_IN', 'PHONE', 'REFERRAL', 'FACEBOOK', 'ONLINE_STORE', 'EXHIBITION', 'OTHER'] as const;

export interface ILeadStageEvent {
  stage: string;
  at: Date;
  by: Types.ObjectId;
  note?: string;
}

/** A sales lead moving through the pipeline until it becomes a customer. */
export interface ILead extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  leadNo: string; // LEAD-2026-0001
  name: string;
  phone: string;
  email?: string;
  company?: string;
  address?: string;
  source: (typeof LEAD_SOURCES)[number];
  stage: (typeof LEAD_STAGES)[number];
  /** Potential order value, used for the pipeline weighting. */
  estimatedValue: number;
  /** 0–100 confidence the lead will close. */
  probability: number;
  assignedTo?: Types.ObjectId | null; // Ref: users
  interestedIn?: string;
  notes?: string;
  nextFollowUpAt?: Date | null;
  lastContactedAt?: Date | null;
  convertedCustomerId?: Types.ObjectId | null; // Ref: customers
  convertedAt?: Date | null;
  lostReason?: string;
  stageHistory: Array<{ stage: string; at: Date; by: Types.ObjectId; note?: string }>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    leadNo: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true },
    company: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    source: { type: String, enum: LEAD_SOURCES, default: 'OTHER', required: true },
    stage: { type: String, enum: LEAD_STAGES, default: 'NEW', required: true, index: true },
    estimatedValue: { type: Number, min: 0, default: 0 },
    probability: { type: Number, min: 0, max: 100, default: 10 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    interestedIn: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 2000 },
    nextFollowUpAt: { type: Date, default: null, index: true },
    lastContactedAt: { type: Date, default: null },
    convertedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    convertedAt: { type: Date, default: null },
    lostReason: { type: String, trim: true, maxlength: 500 },
    stageHistory: {
      type: [
        new Schema<ILeadStageEvent>(
          {
            stage: { type: String, enum: LEAD_STAGES, required: true },
            at: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            note: { type: String, trim: true, maxlength: 300 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'leads' }
);

LeadSchema.index({ orgId: 1, leadNo: 1 }, { unique: true });
LeadSchema.index({ orgId: 1, stage: 1, createdAt: -1 });
LeadSchema.index({ orgId: 1, nextFollowUpAt: 1 });

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
