import mongoose, { Document, Schema, Types } from 'mongoose';

/** The days a route is served — an SR covers a beat only on its service days. */
export const ROUTE_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

/** A delivery/sales route inside a zone — the beat an SR covers. */
export interface IRoute extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  zoneId: Types.ObjectId; // Ref: zones
  name: string;
  code: string;
  areas?: string; // e.g. "Mirpur 1, Mirpur 10, Kazipara"
  /** Service days — which days the SR visits this beat. */
  daysOfWeek: string[];
  assignedSRId?: Types.ObjectId | null; // Ref: sales_reps
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    areas: { type: String, trim: true },
    daysOfWeek: {
      type: [String],
      enum: ROUTE_DAYS as unknown as string[],
      default: [],
    },
    assignedSRId: { type: Schema.Types.ObjectId, ref: 'SalesRep', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'routes' }
);

RouteSchema.index({ orgId: 1, code: 1 }, { unique: true });
// "Which routes run today?" — the SR app's first query of the day.
RouteSchema.index({ orgId: 1, daysOfWeek: 1, isActive: 1 });

export const Route = mongoose.model<IRoute>('Route', RouteSchema);

