import mongoose, { Document, Schema, Types } from 'mongoose';

/** Product group — a folder-like classifier; supports nested sub-groups. */
export interface IProductGroup extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string; // unique per organization
  description?: string;
  parentGroupId?: Types.ObjectId | null; // self-ref for sub-groups
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductGroupSchema = new Schema<IProductGroup>(
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
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    parentGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductGroup',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'product_groups',
  }
);

// Unique group name per organization
ProductGroupSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const ProductGroup = mongoose.model<IProductGroup>('ProductGroup', ProductGroupSchema);
