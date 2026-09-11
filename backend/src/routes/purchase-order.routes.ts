import { Router } from 'express';
import { purchaseOrderController } from '../controllers/PurchaseOrderController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('procurement:view'), (req, res, next) => purchaseOrderController.list(req, res, next));
router.get('/:id', requirePermissions('procurement:view'), (req, res, next) => purchaseOrderController.getById(req, res, next));

router.post('/', requirePermissions('procurement:manage'), (req, res, next) => purchaseOrderController.create(req, res, next));
router.patch('/:id/status', requirePermissions('procurement:manage'), (req, res, next) => purchaseOrderController.updateStatus(req, res, next));
router.post('/:id/grn', requirePermissions('procurement:receive'), (req, res, next) => purchaseOrderController.receiveGRN(req, res, next));

export default router;
