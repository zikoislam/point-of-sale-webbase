import mongoose, { Document, Schema, Types } from 'mongoose';

export const APPROVAL_ENTITIES = ['PURCHASE_ORDER', 'EXPENSE', 'LETTER_OF_CREDIT'] as const;
export type ApprovalEntity = (typeof APPROVAL_ENTITIES)[number];

export interface IWorkflowLevel {
  level: number;
  name: string;
  /** Role that may act at this level (ADMIN, BRANCH_MANAGER, …). Empty = any of approverUserIds. */
  approverRole?: string;
  approverUserIds: Types.ObjectId[];
  requiredApprovals: number;
  /** Stop here and auto-approve the rest when the amount is below this. */
  skipBelowAmount?: number | null;
}

/**
 * Configurable approval chain for one document type (PO, expense, LC).
 * A workflow applies when the document amount falls inside
 * [minAmount, maxAmount]; the most specific (highest minAmount) match wins.
 */
export interface IApprovalWorkflow extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  entityType: ApprovalEntity;
  isActive: boolean;
  minAmount: number;
  maxAmount?: number | null;
  levels: IWorkflowLevel[];
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowLevelSchema = new Schema<IWorkflowLevel>(
  {
    level: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    approverRole: { type: String, trim: true, uppercase: true },
    approverUserIds: { type: [Schema.Types.ObjectId], default: [] },
    requiredApprovals: { type: Number, required: true, min: 1, default: 1 },
    skipBelowAmount: { type: Number, default: null },
  },
  { _id: false }
);

const ApprovalWorkflowSchema = new Schema<IApprovalWorkflow>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    entityType: { type: String, enum: APPROVAL_ENTITIES, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    minAmount: { type: Number, required: true, min: 0, default: 0 },
    maxAmount: { type: Number, default: null },
    levels: {
      type: [WorkflowLevelSchema],
      required: true,
      validate: [(v: IWorkflowLevel[]) => v.length > 0, 'A workflow needs at least one level'],
    },
    description: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'approval_workflows' }
);

ApprovalWorkflowSchema.index({ orgId: 1, entityType: 1, isActive: 1, minAmount: 1 });

export const ApprovalWorkflow = mongoose.model<IApprovalWorkflow>('ApprovalWorkflow', ApprovalWorkflowSchema);
