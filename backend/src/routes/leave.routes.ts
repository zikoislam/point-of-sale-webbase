import { Router } from 'express';
import { leaveController } from '../controllers/LeaveController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/summary', requirePermissions('hr:view'), (req, res, next) => leaveController.summary(req, res, next));

router.get('/', requirePermissions('hr:view'), (req, res, next) => leaveController.list(req, res, next));
router.post('/', requirePermissions('hr:attendance'), (req, res, next) => leaveController.create(req, res, next));
router.put('/:id/approve', requirePermissions('hr:manage'), (req, res, next) => leaveController.approve(req, res, next));
router.put('/:id/reject', requirePermissions('hr:manage'), (req, res, next) => leaveController.reject(req, res, next));
router.put('/:id/cancel', requirePermissions('hr:attendance'), (req, res, next) => leaveController.cancel(req, res, next));

export default router;
