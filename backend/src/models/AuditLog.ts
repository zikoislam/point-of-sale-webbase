import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Ref: users (Actor)
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PRICE_OVERRIDE' | 'OFFLINE_OVERSELL' | 'SHIFT_DISCREPANCY';
  entity: string; // "sales", "products", "shifts", "accounts"
  entityId: string; // Primary key string of target document
  metadata: Record<string, any>; // JSON diff payload: before/after snapshots
  ipAddress?: string;
  createdAt: Date; // Immutable timestamp
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'PRICE_OVERRIDE', 'OFFLINE_OVERSELL', 'SHIFT_DISCREPANCY'],
      required: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'audit_logs',
  }
);

// Indexes
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
