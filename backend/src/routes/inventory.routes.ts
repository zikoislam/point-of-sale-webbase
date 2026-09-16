import { Router } from 'express';
import { wastageController } from '../controllers/WastageController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { stockAdjustmentController } from '../controllers/StockAdjustmentController';

const router = Router();

router.use(authenticate);

router.get('/wastage', requirePermissions('inv:view'), (req, res, next) => wastageController.list(req, res, next));
router.post('/wastage', requirePermissions('inv:adjust'), (req, res, next) => wastageController.record(req, res, next));

router.get('/adjustments', requirePermissions('inv:view'), (req, res, next) => stockAdjustmentController.list(req, res, next));
router.post('/adjustments', requirePermissions('inv:adjust'), (req, res, next) => stockAdjustmentController.request(req, res, next));
router.put('/adjustments/:id/approve', requirePermissions('approvals:manage'), (req, res, next) => stockAdjustmentController.approve(req, res, next));

export default router;
