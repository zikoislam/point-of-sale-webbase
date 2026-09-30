import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICrmActivity extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  customerId: Types.ObjectId; // Ref: customers
  type: 'CALL' | 'VISIT' | 'NOTE' | 'TASK' | 'COMPLAINT';
  subject: string;
  notes?: string;
  dueDate?: Date | null;
  status: 'OPEN' | 'DONE';
  assignedToUserId?: Types.ObjectId | null;
  completedAt?: Date | null;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CrmActivitySchema = new Schema<ICrmActivity>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: { type: String, enum: ['CALL', 'VISIT', 'NOTE', 'TASK', 'COMPLAINT'], required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ['OPEN', 'DONE'], default: 'OPEN', index: true },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'crm_activities' }
);

export const CrmActivity = mongoose.model<ICrmActivity>('CrmActivity', CrmActivitySchema);
