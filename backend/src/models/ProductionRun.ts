import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProductionMaterialIssue {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  variantSku: string; // snapshot
  productName: string; // snapshot
  quantity: number;
  unitCost: number; // WAC at issue time
  lineCost: number;
}

export interface IProductionRun extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  runNo: string;
  bomId: Types.ObjectId; // Ref: boms
  productId: Types.ObjectId; // finished good
  plannedQty: number;
  producedQty: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  unitCost: number; // total cost / producedQty
  issues: IProductionMaterialIssue[];
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedById?: Types.ObjectId | null;
  startedAt?: Date;
  completedById?: Types.ObjectId | null;
  completedAt?: Date;
  notes?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialIssueSchema = new Schema<IProductionMaterialIssue>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    variantSku: { type: String, trim: true },
    productName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitCost: { type: Number, required: true, min: 0 },
    lineCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ProductionRunSchema = new Schema<IProductionRun>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    runNo: { type: String, required: true, trim: true },
    bomId: { type: Schema.Types.ObjectId, ref: 'Bom', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    plannedQty: { type: Number, required: true, min: 0.001 },
    producedQty: { type: Number, required: true, default: 0, min: 0 },
    materialCost: { type: Number, required: true, default: 0, min: 0 },
    laborCost: { type: Number, required: true, default: 0, min: 0 },
    overheadCost: { type: Number, required: true, default: 0, min: 0 },
    unitCost: { type: Number, required: true, default: 0, min: 0 },
    issues: { type: [MaterialIssueSchema], default: [] },
    status: {
      type: String,
      enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
      required: true,
      index: true,
    },
    startedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date },
    completedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date },
    notes: { type: String, trim: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'production_runs' }
);

ProductionRunSchema.index({ orgId: 1, runNo: 1 }, { unique: true });

export const ProductionRun = mongoose.model<IProductionRun>('ProductionRun', ProductionRunSchema);
