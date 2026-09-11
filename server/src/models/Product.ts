import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBatchLot {
  batchNo: string; // e.g. "BATCH-2026-09-001"
  costPrice: number; // Purchase cost for this specific lot
  expiryDate?: Date; // FEFO expiry date for this lot
  quantity: number; // Remaining stock in this lot
  receivedAt: Date; // When this lot was received (GRN date)
}

export interface IVariant {
  _id: Types.ObjectId;
  sku: string; // Unique, e.g. "SKU-MILK-1000ML"
  barcode?: string; // Unique EAN-13 / Code-128 (sparse)
  attributeName: string; // "1 Liter" | "500g" | "Blue / XL"
  costPrice: number; // Weighted average cost price (WAC)
  retailSellingPrice: number; // Standard retail consumer price (MRP)
  wholesaleSellingPrice: number; // Bulk/trade tier selling price
  currentStock: number; // Real-time total on-hand inventory count
  alertQty: number; // Reorder alert trigger threshold
  batches?: IBatchLot[]; // FEFO lot tracking
  rackLocation?: string; // e.g. "Aisle 3 - Shelf B"
  isAvailable: boolean;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  categoryId: Types.ObjectId; // Ref: categories
  brandId?: Types.ObjectId; // Ref: brands
  supplierId?: Types.ObjectId; // Ref: suppliers
  unit: 'Pcs' | 'Kg' | 'Gram' | 'Ltr' | 'Ml' | 'Box' | 'Meter' | 'Goj';
  imageUrl?: string;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT';
  taxRate: number; // Percentage VAT
  variants: IVariant[];
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BatchLotSchema = new Schema<IBatchLot>(
  {
    batchNo: { type: String, required: true, trim: true },
    costPrice: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true, default: 0 },
    receivedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VariantSchema = new Schema<IVariant>(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: undefined,
    },
    attributeName: {
      type: String,
      required: true,
      trim: true,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    retailSellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    wholesaleSellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
    },
    alertQty: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },
    batches: {
      type: [BatchLotSchema],
      default: [],
    },
    rackLocation: {
      type: String,
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      default: null,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    unit: {
      type: String,
      enum: ['Pcs', 'Kg', 'Gram', 'Ltr', 'Ml', 'Box', 'Meter', 'Goj'],
      required: true,
      default: 'Pcs',
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    taxType: {
      type: String,
      enum: ['INCLUSIVE', 'EXCLUSIVE', 'EXEMPT'],
      required: true,
      default: 'INCLUSIVE',
    },
    taxRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    variants: {
      type: [VariantSchema],
      required: true,
      validate: [(val: IVariant[]) => val.length > 0, 'At least one variant is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'products',
  }
);

// Indexes
ProductSchema.index({ 'variants.sku': 1 }, { unique: true });
ProductSchema.index({ 'variants.barcode': 1 }, { unique: true, sparse: true });
ProductSchema.index(
  { name: 'text', 'variants.attributeName': 'text' },
  { weights: { name: 10, 'variants.attributeName': 5 }, name: 'product_text_search' }
);
ProductSchema.index({ categoryId: 1, isActive: 1 });
ProductSchema.index({ supplierId: 1 });
ProductSchema.index({ 'variants.currentStock': 1 });
ProductSchema.index({ 'variants.batches.expiryDate': 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
