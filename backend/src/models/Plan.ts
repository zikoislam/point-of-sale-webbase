import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A subscription plan (Plan 1 / Plan 2 / Plan 3 …), platform-global.
 *
 * A plan bundles:
 *  - a default key duration (`durationDays`);
 *  - a price label (`price`) — no gateway, manual billing;
 *  - display features (`features`) shown as chips in the console;
 *  - a real permission gate: `permissionSet` is the organization envelope that
 *    a key issued from this plan applies on redemption (`applyPermissions`).
 *
 * `plans` has no `orgId` path, so the tenant-scoping plugin ignores it.
 */
export interface IPlan extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  durationDays: number;
  price: number;
  description?: string;
  features: string[];
  permissionSet: string[];
  applyPermissions: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true },
    features: { type: [String], default: [] },
    permissionSet: { type: [String], default: [] },
    applyPermissions: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false, collection: 'plans' }
);

PlanSchema.index({ code: 1 }, { unique: true });
PlanSchema.index({ sortOrder: 1, name: 1 });

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
