import mongoose, { Document, Schema, Types } from 'mongoose';

/** A spend tier — the more a customer has ever earned, the better the earn rate. */
export interface ILoyaltyTier {
  name: string; // e.g. SILVER / GOLD / PLATINUM
  minLifetimePoints: number;
  bonusMultiplier: number; // 1.5 → 50% more points on every earning
}

export interface ILoyaltyConfig extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId; // unique per org
  /** Points earned per Taka spent, e.g. 0.05 → 5 points per 100tk. */
  pointsPerTk: number;
  /** Taka value of one point when redeemed, e.g. 0.5 → 100 points = 50tk. */
  redeemValuePerPoint: number;
  minPointsToRedeem: number;
  /** A single bill can never be discounted more than this share with points. */
  maxRedeemPercent: number;
  /** Points die this many days after they are earned (0 = they never expire). */
  expiryDays: number;
  /** Tier ladder, evaluated on lifetime points. */
  tiers: ILoyaltyTier[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyTierSchema = new Schema<ILoyaltyTier>(
  {
    name: { type: String, required: true, trim: true, uppercase: true },
    minLifetimePoints: { type: Number, required: true, min: 0, default: 0 },
    bonusMultiplier: { type: Number, required: true, min: 1, max: 10, default: 1 },
  },
  { _id: false }
);

const LoyaltyConfigSchema = new Schema<ILoyaltyConfig>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    pointsPerTk: { type: Number, required: true, default: 0.05, min: 0, max: 10 },
    redeemValuePerPoint: { type: Number, required: true, default: 0.5, min: 0, max: 1000 },
    minPointsToRedeem: { type: Number, required: true, default: 100, min: 0 },
    maxRedeemPercent: { type: Number, required: true, default: 100, min: 0, max: 100 },
    expiryDays: { type: Number, required: true, default: 0, min: 0 },
    tiers: {
      type: [LoyaltyTierSchema],
      default: [
        { name: 'SILVER', minLifetimePoints: 0, bonusMultiplier: 1 },
        { name: 'GOLD', minLifetimePoints: 10000, bonusMultiplier: 1.25 },
        { name: 'PLATINUM', minLifetimePoints: 50000, bonusMultiplier: 1.5 },
      ],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'loyalty_configs' }
);

export const LoyaltyConfig = mongoose.model<ILoyaltyConfig>('LoyaltyConfig', LoyaltyConfigSchema);
