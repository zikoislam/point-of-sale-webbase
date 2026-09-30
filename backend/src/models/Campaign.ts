import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICampaign extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  channel: 'SMS' | 'WHATSAPP' | 'PHONE' | 'EMAIL';
  /** Simple audience rule — the segment is computed over customer history. */
  segment: {
    customerType?: 'RETAIL' | 'WHOLESALE' | 'DEALER';
    minPurchases?: number;
    minSpend?: number;
    inactiveDays?: number;
  };
  startsAt: Date;
  endsAt?: Date | null;
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  audienceCount: number;
  message?: string;
  notes?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    channel: { type: String, enum: ['SMS', 'WHATSAPP', 'PHONE', 'EMAIL'], required: true },
    segment: {
      customerType: { type: String, enum: ['RETAIL', 'WHOLESALE', 'DEALER'] },
      minPurchases: { type: Number, min: 0 },
      minSpend: { type: Number, min: 0 },
      inactiveDays: { type: Number, min: 0 },
    },
    startsAt: { type: Date, required: true, default: Date.now },
    endsAt: { type: Date, default: null },
    status: { type: String, enum: ['DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED'], default: 'DRAFT', index: true },
    audienceCount: { type: Number, required: true, default: 0, min: 0 },
    message: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 500 },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'campaigns' }
);

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
