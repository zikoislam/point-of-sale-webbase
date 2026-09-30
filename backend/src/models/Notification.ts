import mongoose, { Document, Schema, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'LOW_STOCK',
  'PO_APPROVAL',
  'NEW_SALE',
  'DUE_ALERT',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A persisted, org-scoped notification shown in the header bell. */
export interface INotification extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** null → everyone in the organization (e.g. a new sale). */
  userId?: Types.ObjectId | null;
  type: NotificationType;
  title: string;
  message: string;
  /** Where a click should take the user, e.g. "purchase-orders". */
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'notifications' }
);

NotificationSchema.index({ orgId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ orgId: 1, userId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
