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
  /**
   * When the paid subscription lapses. `null` means unlimited/legacy — such an
   * org is never locked, so shipping subscriptions does not lock existing
   * installs by surprise. Set by the platform Super Admin (directly or via a
   * redeemed license key).
   */
  subscriptionEndsAt: Date | null;
  /** Days after `subscriptionEndsAt` during which the app still works (warned). */
  subscriptionGraceDays: number;
  /** Free-text plan label: TRIAL | STANDARD | LIFETIME | … */
  subscriptionPlan: string;
  subscriptionNote?: string;
  lastExtendedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 'UNLIMITED' | 'ACTIVE' | 'GRACE' | 'EXPIRED';

export interface SubscriptionState {
  status: SubscriptionStatus;
  endsAt: Date | null;
  graceDays: number;
  /** Whole days until expiry (0 once expired); `null` when unlimited. */
  daysRemaining: number | null;
  /** Whole days past `subscriptionEndsAt` (0 while active). */
  daysOverdue: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pure computation of an organization's subscription state at a point in time.
 * No DB access — callers pass the org document (or just the two fields).
 */
export function resolveSubscriptionState(
  org: Pick<IOrganization, 'subscriptionEndsAt' | 'subscriptionGraceDays'> | null | undefined,
  now: Date = new Date()
): SubscriptionState {
  const graceDays = org?.subscriptionGraceDays ?? 0;
  const rawEndsAt = org?.subscriptionEndsAt ?? null;

  if (!rawEndsAt) {
    return { status: 'UNLIMITED', endsAt: null, graceDays, daysRemaining: null, daysOverdue: 0 };
  }

  const endsAt = new Date(rawEndsAt);
  const diffMs = endsAt.getTime() - now.getTime();

  if (diffMs >= 0) {
    return {
      status: 'ACTIVE',
      endsAt,
      graceDays,
      daysRemaining: Math.ceil(diffMs / MS_PER_DAY),
      daysOverdue: 0,
    };
  }

  const daysOverdue = Math.floor((now.getTime() - endsAt.getTime()) / MS_PER_DAY);
  const inGrace = now.getTime() <= endsAt.getTime() + graceDays * MS_PER_DAY;

  return {
    status: inGrace ? 'GRACE' : 'EXPIRED',
    endsAt,
    graceDays,
    daysRemaining: 0,
    daysOverdue,
  };
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
    subscriptionEndsAt: {
      type: Date,
      default: null,
    },
    subscriptionGraceDays: {
      type: Number,
      default: 7,
      min: 0,
    },
    subscriptionPlan: {
      type: String,
      default: 'STANDARD',
      trim: true,
    },
    subscriptionNote: {
      type: String,
      trim: true,
    },
    lastExtendedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'organizations',
  }
);

OrganizationSchema.index({ subscriptionEndsAt: 1 });

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);
