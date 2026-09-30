import mongoose, { Document, Schema, Types } from 'mongoose';

export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;

/** A job / contract whose costs and revenues are tracked separately. */
export interface IProject extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  code: string; // PRJ-2026-0001
  name: string;
  description?: string;
  customerId?: Types.ObjectId | null; // Ref: customers (the client)
  managerId?: Types.ObjectId | null; // Ref: users
  startDate?: Date | null;
  endDate?: Date | null;
  budget: number;
  status: (typeof PROJECT_STATUSES)[number];
  tags: string[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    budget: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'PLANNED',
      required: true,
      index: true,
    },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'projects' }
);

ProjectSchema.index({ orgId: 1, code: 1 }, { unique: true });
ProjectSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
