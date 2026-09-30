import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * The loyalty ledger — one row per movement of points.
 *
 * Points are always stored positive; the type carries the direction. Keeping a
 * row per movement is what makes a customer statement (and the points liability
 * on the books) auditable instead of a single running number.
 */
export interface ILoyaltyTransaction extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  customerId: Types.ObjectId; // Ref: customers
  type: 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST';
  /** Points moved — always positive. */
  points: number;
  /** Balance after this movement, so the statement never has to be recomputed. */
  balanceAfter: number;
  /** Lifetime points after this movement (earn/adjust only). */
  lifetimeAfter?: number;
  /** The bill that earned or spent the points. */
  relatedSaleId?: Types.ObjectId | null; // Ref: sales
  narration?: string;
  /** EARN rows only: when these points stop being valid. */
  expiresAt?: Date | null;
  /** EARN rows consumed by an expiry run. */
  expired?: boolean;
  createdById?: Types.ObjectId | null; // Ref: users
  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['EARN', 'REDEEM', 'EXPIRE', 'ADJUST'],
      required: true,
    },
    points: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    lifetimeAfter: { type: Number, min: 0 },
    relatedSaleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
    narration: { type: String, trim: true, maxlength: 200 },
    expiresAt: { type: Date, default: null },
    expired: { type: Boolean, default: false },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false, collection: 'loyalty_transactions' }
);

// Customer statement (newest first)
LoyaltyTransactionSchema.index({ orgId: 1, customerId: 1, createdAt: -1 });
// Analytics by movement type
LoyaltyTransactionSchema.index({ orgId: 1, type: 1, createdAt: -1 });
// The expiry sweep: unexpired earning rows that have passed their date
LoyaltyTransactionSchema.index({ orgId: 1, type: 1, expired: 1, expiresAt: 1 });

export const LoyaltyTransaction = mongoose.model<ILoyaltyTransaction>(
  'LoyaltyTransaction',
  LoyaltyTransactionSchema
);
