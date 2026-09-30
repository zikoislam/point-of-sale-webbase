import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBomItem {
  componentProductId: Types.ObjectId;
  quantity: number; // per one output batch
  wastagePercent: number;
}

/** Bill of Materials — the recipe that turns components into a finished good. */
export interface IBom extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  productId: Types.ObjectId; // Ref: products — the finished good
  outputQty: number; // units produced per run of this BOM
  version: number;
  items: IBomItem[];
  laborCost: number; // per run
  overheadCost: number; // per run
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BomItemSchema = new Schema<IBomItem>(
  {
    componentProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    wastagePercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const BomSchema = new Schema<IBom>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    outputQty: { type: Number, required: true, min: 0.001 },
    version: { type: Number, required: true, default: 1 },
    items: {
      type: [BomItemSchema],
      required: true,
      validate: [(v: IBomItem[]) => v.length > 0, 'A BOM needs at least one component'],
    },
    laborCost: { type: Number, required: true, default: 0, min: 0 },
    overheadCost: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'boms' }
);

export const Bom = mongoose.model<IBom>('Bom', BomSchema);
