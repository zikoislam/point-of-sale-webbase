import mongoose, { Document, Schema, Types } from 'mongoose';

/** Sales Representative — the field salesperson who owns dealers on a route. */
export interface ISalesRep extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  code: string; // e.g. "SR-001"
  name: string;
  phone: string;
  /** Optional login account — lets the SR use the SR app pages. */
  userId?: Types.ObjectId | null; // Ref: users
  zoneId?: Types.ObjectId | null; // Ref: zones
  commissionPercent: number;
  monthlyTargetAmount: number;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SalesRepSchema = new Schema<ISalesRep>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null },
    commissionPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
    monthlyTargetAmount: { type: Number, required: true, default: 0, min: 0 },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'sales_reps' }
);

SalesRepSchema.index({ orgId: 1, code: 1 }, { unique: true });
SalesRepSchema.index({ phone: 1 });

export const SalesRep = mongoose.model<ISalesRep>('SalesRep', SalesRepSchema);
