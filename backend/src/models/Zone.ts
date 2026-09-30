import mongoose, { Document, Schema, Types } from 'mongoose';

/** A sales territory — zones group routes, routes group dealers/customers. */
export interface IZone extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'zones' }
);

ZoneSchema.index({ orgId: 1, code: 1 }, { unique: true });

export const Zone = mongoose.model<IZone>('Zone', ZoneSchema);
