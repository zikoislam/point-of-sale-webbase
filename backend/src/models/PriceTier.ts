import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPriceTier extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string; // "Retail", "Wholesale", "Dealer", "Distributor"…
  /** Percentage taken off the retail price, e.g. 10 → 100tk MRP sells at 90tk. */
  discountPercent: number;
  /** Lower wins when two tiers could apply. */
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PriceTierSchema = new Schema<IPriceTier>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    priority: {
      type: Number,
      required: true,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'price_tiers',
  }
);

PriceTierSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const PriceTier = mongoose.model<IPriceTier>('PriceTier', PriceTierSchema);
