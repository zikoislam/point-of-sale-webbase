import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
// Any logged-in member may read their own notification feed.
const router = Router();

router.get('/', (req, res, next) => notificationController.list(req, res, next));
router.get('/unread-count', (req, res, next) => notificationController.unreadCount(req, res, next));
router.put('/mark-all-read', (req, res, next) => notificationController.markAllRead(req, res, next));
router.put('/:id/read', (req, res, next) => notificationController.markRead(req, res, next));
router.delete('/:id', (req, res, next) => notificationController.remove(req, res, next));

export default router;
