import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string; // Unique, URL-friendly identifier
  status: 'ACTIVE' | 'SUSPENDED';
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  /**
   * The permission ceiling for this whole organization, set by the platform
   * Super Admin. Effective permissions of every org member are intersected
   * with this set, so shrinking it instantly revokes access everywhere.
   */
  adminPermissionSet: string[];
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      required: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    adminPermissionSet: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'organizations',
  }
);

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);
