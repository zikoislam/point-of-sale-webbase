import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICategory extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  code: string; // Short uppercase slug, e.g. "BEV-COLD"
  parentId?: Types.ObjectId; // Ref: categories (For nested subcategories)
  defaultTaxRate?: number; // Default VAT % inherited by products without explicit taxRate
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
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
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    defaultTaxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
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
    collection: 'categories',
  }
);

// Indexes
CategorySchema.index({ orgId: 1, code: 1 }, { unique: true });
CategorySchema.index({ parentId: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
