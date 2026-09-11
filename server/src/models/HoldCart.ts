import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IHoldCartItem {
  variantId: Types.ObjectId;
  productName: string; // Snapshot
  variantName: string; // Snapshot
  sku: string; // Snapshot
  barcode?: string; // Snapshot
  quantity: number; // Supports decimal (e.g. 2.5 Goj)
  unitSellingPrice: number; // Applied price at hold time
  taxRate: number;
  taxAmount: number;
  discount: number;
  lineTotal: number;
}

export interface IHoldCart extends Document {
  _id: Types.ObjectId;
  cartLabel?: string; // Optional user label, e.g. "Customer: Rahim"
  userId: Types.ObjectId; // Ref: users (Cashier who parked cart)
  shiftId: Types.ObjectId; // Ref: shifts (Active shift at hold time)
  customerId?: Types.ObjectId; // Ref: customers (If customer was selected)
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: IHoldCartItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  expiresAt: Date; // TTL: auto-deleted after 24h
  createdAt: Date;
}

const HoldCartItemSchema = new Schema<IHoldCartItem>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitSellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const HoldCartSchema = new Schema<IHoldCart>(
  {
    cartLabel: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    pricingTier: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE'],
      default: 'RETAIL',
      required: true,
    },
    items: {
      type: [HoldCartItemSchema],
      required: true,
      validate: [(val: IHoldCartItem[]) => val.length > 0, 'Hold cart must contain at least one item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'hold_carts',
  }
);

// Indexes
HoldCartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL Index
HoldCartSchema.index({ userId: 1, shiftId: 1, createdAt: -1 });

export const HoldCart = mongoose.model<IHoldCart>('HoldCart', HoldCartSchema);
