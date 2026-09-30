import mongoose, { Document, Schema, Types } from 'mongoose';

/** A shop / showroom / warehouse in a chain (head office or a branch). */
export interface IBranch extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  code: string; // unique per org, e.g. "BR-001"
  address?: string;
  city?: string;
  phone?: string;
  managerId?: Types.ObjectId | null; // Ref: users
  isHeadOffice: boolean;
  isActive: boolean;
  settings: {
    allowNegativeStock: boolean;
    defaultPriceType: 'RETAIL' | 'WHOLESALE';
  };
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isHeadOffice: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    settings: {
      allowNegativeStock: { type: Boolean, default: false },
      defaultPriceType: { type: String, enum: ['RETAIL', 'WHOLESALE'], default: 'RETAIL' },
    },
  },
  { timestamps: true, versionKey: false, collection: 'branches' }
);

// Unique branch code per organization
BranchSchema.index({ orgId: 1, code: 1 }, { unique: true });
BranchSchema.index({ orgId: 1, isActive: 1 });

export const Branch = mongoose.model<IBranch>('Branch', BranchSchema);
