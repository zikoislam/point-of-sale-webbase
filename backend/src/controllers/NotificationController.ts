import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/NotificationService';
import { sendSuccess } from '../utils/api-response';

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const rows = await notificationService.listForUser(req.user!.userId, { isRead, limit });
      sendSuccess(res, 200, 'Notifications retrieved', rows);
    } catch (error) { next(error); }
  }

  async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.unreadCount(req.user!.userId);
      sendSuccess(res, 200, 'Unread count retrieved', { count });
    } catch (error) { next(error); }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await notificationService.markRead(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Notification marked as read', doc);
    } catch (error) { next(error); }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.markAllRead(req.user!.userId);
      sendSuccess(res, 200, 'All notifications marked as read', result);
    } catch (error) { next(error); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.remove(req.params.id);
      sendSuccess(res, 200, 'Notification deleted', result);
    } catch (error) { next(error); }
  }
}

export const notificationController = new NotificationController();
