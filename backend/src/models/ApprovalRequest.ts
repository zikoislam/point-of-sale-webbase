import mongoose, { Document, Schema, Types } from 'mongoose';
import { APPROVAL_ENTITIES, ApprovalEntity } from './ApprovalWorkflow';

export interface IApprovalDecision {
  by: Types.ObjectId;
  byName?: string;
  at: Date;
  decision: 'APPROVED' | 'REJECTED' | 'CANCELLED';
  comment?: string;
}

export interface IRequestLevel {
  level: number;
  name: string;
  approverRole?: string;
  approverUserIds: Types.ObjectId[];
  requiredApprovals: number;
  /** Snapshot of the workflow level so history survives a config change. */
  approvals: IApprovalDecision[];
  /** level complete (enough approvals) or short-circuited */
  completed: boolean;
  skippedByAmount?: boolean;
}

/** One document waiting in the approval chain. */
export interface IApprovalRequest extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  workflowId: Types.ObjectId;
  workflowName: string;
  entityType: ApprovalEntity;
  entityId: Types.ObjectId;
  /** Human reference shown in the inbox, e.g. PO-2026-0007. */
  entityRef: string;
  title: string;
  amount: number;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  currentLevel: number;
  levels: IRequestLevel[];
  history: IApprovalDecision[];
  decidedAt?: Date | null;
  decidedBy?: Types.ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DecisionSchema = new Schema<IApprovalDecision>(
  {
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    byName: { type: String, trim: true },
    at: { type: Date, required: true, default: Date.now },
    decision: { type: String, enum: ['APPROVED', 'REJECTED', 'CANCELLED'], required: true },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const RequestLevelSchema = new Schema<IRequestLevel>(
  {
    level: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    approverRole: { type: String, trim: true, uppercase: true },
    approverUserIds: { type: [Schema.Types.ObjectId], default: [] },
    requiredApprovals: { type: Number, required: true, min: 1, default: 1 },
    approvals: { type: [DecisionSchema], default: [] },
    completed: { type: Boolean, default: false },
    skippedByAmount: { type: Boolean, default: false },
  },
  { _id: false }
);

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    workflowId: { type: Schema.Types.ObjectId, ref: 'ApprovalWorkflow', required: true },
    workflowName: { type: String, required: true, trim: true },
    entityType: { type: String, enum: APPROVAL_ENTITIES, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    entityRef: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    amount: { type: Number, required: true, min: 0, default: 0 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    currentLevel: { type: Number, required: true, default: 1 },
    levels: { type: [RequestLevelSchema], default: [] },
    history: { type: [DecisionSchema], default: [] },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, versionKey: false, collection: 'approval_requests' }
);

// The inbox query: pending first, then newest
ApprovalRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });
ApprovalRequestSchema.index({ orgId: 1, entityType: 1, entityId: 1 });

export const ApprovalRequest = mongoose.model<IApprovalRequest>('ApprovalRequest', ApprovalRequestSchema);
