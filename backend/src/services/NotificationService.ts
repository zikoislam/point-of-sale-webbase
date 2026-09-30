import { Types } from 'mongoose';
import { Notification, INotification, NotificationType } from '../models/Notification';
import { AppError } from '../utils/app-error';
import { currentOrgId } from '../middlewares/org.context';
import { emitEvent } from '../sockets';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  /** null / omitted → everyone in the organization */
  userId?: string | null;
}

/**
 * Persisted notifications for the header bell. Every create also pushes a
 * live Socket.IO event into the organization's room, so the badge updates
 * without a refresh.
 */
class NotificationService {
  async create(data: CreateNotificationInput): Promise<INotification | null> {
    const orgId = currentOrgId();
    if (!orgId) return null; // platform context has no org to notify

    try {
      const doc = await Notification.create({
        orgId: new Types.ObjectId(orgId),
        userId: data.userId && Types.ObjectId.isValid(data.userId) ? new Types.ObjectId(data.userId) : null,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
      });

      // Live push — fire and forget, never blocks the calling business flow
      emitEvent(
        'NOTIFICATION',
        {
          id: String(doc._id),
          type: doc.type,
          title: doc.title,
          message: doc.message,
          entityType: doc.entityType,
          entityId: doc.entityId,
          isRead: false,
          createdAt: doc.createdAt,
        },
        `org:${orgId}`
      );

      return doc.toObject() as unknown as INotification;
    } catch (err) {
      // Notifications must never break a sale / PO / shift operation
      console.warn('notification create failed:', (err as Error).message);
      return null;
    }
  }

  /** Non-blocking helper for use inside business flows. */
  notify(data: CreateNotificationInput): void {
    void this.create(data);
  }

  async list(options: { isRead?: boolean; limit?: number; type?: string } = {}) {
    const filter: Record<string, any> = {
      // Personal + broadcast notifications for this user
      $or: [{ userId: null }],
    };
    if (options.isRead !== undefined) filter.isRead = options.isRead;
    if (options.type) filter.type = options.type;

    return Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, options.limit || 20))
      .lean();
  }

  /**
   * Personal notifications belong to one user; broadcast rows (userId null) are
   * shared, so "read" is tracked per notification document.
   */
  async listForUser(userId: string, options: { isRead?: boolean; limit?: number } = {}) {
    const filter: Record<string, any> = {
      $or: [{ userId: null }, { userId: new Types.ObjectId(userId) }],
    };
    if (options.isRead !== undefined) filter.isRead = options.isRead;

    return Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, options.limit || 20))
      .lean();
  }

  async unreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      $or: [{ userId: null }, { userId: new Types.ObjectId(userId) }],
      isRead: false,
    });
  }

  async markRead(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid notification ID');
    const doc = await Notification.findById(id);
    if (!doc) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    doc.isRead = true;
    doc.readAt = new Date();
    await doc.save();
    return doc.toObject() as unknown as INotification;
  }

  async markAllRead(userId: string) {
    await Notification.updateMany(
      { $or: [{ userId: null }, { userId: new Types.ObjectId(userId) }], isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return { ok: true };
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid notification ID');
    await Notification.deleteOne({ _id: id });
    return { ok: true };
  }
}

export const notificationService = new NotificationService();
