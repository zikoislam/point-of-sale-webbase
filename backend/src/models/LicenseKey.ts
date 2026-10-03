import mongoose, { Document, Schema, Types } from 'mongoose';

export type LicenseKeyStatus = 'ISSUED' | 'REDEEMED' | 'REVOKED';

export interface ILicenseKey extends Document {
  _id: Types.ObjectId;
  /** Human-readable, single-use key, e.g. POS-7F3K9Q2A-30D. */
  key: string;
  /** Tenant the key belongs to. Scoped by the org plugin like every other model. */
  orgId: Types.ObjectId;
  /** Days added to the subscription when redeemed. */
  days: number;
  plan?: string;
  status: LicenseKeyStatus;
  issuedBy: Types.ObjectId;
  issuedAt: Date;
  redeemedBy?: Types.ObjectId;
  redeemedAt?: Date;
  revokedBy?: Types.ObjectId;
  /** Optional machine binding for the desktop build. */
  machineId?: string;
  note?: string;
  /** Optional expiry for the key itself (unredeemed keys past this are rejected). */
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LicenseKeySchema = new Schema<ILicenseKey>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    plan: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ISSUED', 'REDEEMED', 'REVOKED'],
      default: 'ISSUED',
      required: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    redeemedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    redeemedAt: {
      type: Date,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    machineId: {
      type: String,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'license_keys',
  }
);

LicenseKeySchema.index({ orgId: 1, status: 1 });
LicenseKeySchema.index({ status: 1, createdAt: -1 });

export const LicenseKey = mongoose.model<ILicenseKey>('LicenseKey', LicenseKeySchema);
