import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  /** The person to talk to at the shop — the owner's name, when the account is a business. */
  contactPerson?: string;
  phone: string; // Unique Index
  email?: string;
  /** BIN / TIN — printed on wholesale invoices for business buyers. */
  taxId?: string;
  address?: string;
  /** Configurable price tier applied automatically at checkout. */
  priceTierId?: Types.ObjectId; // Ref: price_tiers
  /** RETAIL walk-in, WHOLESALE shop, or DEALER on an SR route. */
  customerType?: 'RETAIL' | 'WHOLESALE' | 'DEALER';
  /** Dealer fields */
  routeId?: Types.ObjectId | null; // Ref: routes
  assignedSRId?: Types.ObjectId | null; // Ref: sales_reps
  creditDays?: number; // agreed payment window for the dealer
  creditLimit: number; // Maximum allowed due balance
  currentDueBalance: number; // Outstanding debt
  loyaltyPoints: number;
  /** Spend tier, derived from lifetimePoints (NONE until they earn). */
  loyaltyTier: 'NONE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  /** Points ever earned — the ladder tier is based on, never reduced by redeeming. */
  lifetimePoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    taxId: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    address: {
      type: String,
      trim: true,
    },
    priceTierId: {
      type: Schema.Types.ObjectId,
      ref: 'PriceTier',
      default: null,
    },
    customerType: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE', 'DEALER'],
      default: 'RETAIL',
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    assignedSRId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesRep',
      default: null,
    },
    creditDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditLimit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currentDueBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    loyaltyPoints: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    loyaltyTier: {
      type: String,
      enum: ['NONE', 'SILVER', 'GOLD', 'PLATINUM'],
      default: 'NONE',
    },
    lifetimePoints: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'customers',
  }
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);

// Unique phone number per organization (not globally)
CustomerSchema.index({ orgId: 1, phone: 1 }, { unique: true });
// Reporting paths (Phase 12.1)
CustomerSchema.index({ orgId: 1, customerType: 1 });
CustomerSchema.index({ orgId: 1, priceTierId: 1 });
CustomerSchema.index({ orgId: 1, assignedSRId: 1 });
