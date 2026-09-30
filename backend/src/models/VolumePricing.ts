import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVolumeTierRule {
  /** Inclusive lower bound of the quantity band. */
  minQty: number;
  /** Inclusive upper bound; null/undefined = open-ended (minQty and above). */
  maxQty?: number | null;
  /** Percentage off the resolved unit price (0-100). */
  discountPercent: number;
  /** Absolute unit price for this band — wins over discountPercent when set. */
  fixedPrice?: number | null;
}

/**
 * Quantity-based (volume / trade) pricing for one product (optionally one
 * variant) and one customer type.
 */
export interface IVolumePricing extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  productId: Types.ObjectId; // Ref: products
  variantId?: Types.ObjectId | null; // Ref: products.variants (optional)
  customerType: 'RETAIL' | 'WHOLESALE' | 'ALL';
  tiers: IVolumeTierRule[];
  validFrom?: Date | null;
  validTo?: Date | null;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VolumeTierSchema = new Schema<IVolumeTierRule>(
  {
    minQty: { type: Number, required: true, min: 0 },
    maxQty: { type: Number, default: null, min: 0 },
    discountPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
    fixedPrice: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const VolumePricingSchema = new Schema<IVolumePricing>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    customerType: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE', 'ALL'],
      default: 'ALL',
      required: true,
    },
    tiers: {
      type: [VolumeTierSchema],
      required: true,
      validate: [(v: IVolumeTierRule[]) => v.length > 0, 'At least one tier is required'],
    },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'volume_pricing',
  }
);

VolumePricingSchema.index({ orgId: 1, productId: 1, customerType: 1 });

export const VolumePricing = mongoose.model<IVolumePricing>('VolumePricing', VolumePricingSchema);
