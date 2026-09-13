import { Router } from 'express';
import { purchaseOrderController } from '../controllers/PurchaseOrderController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createPurchaseOrderSchema,
  grnSchema,
  updatePOStatusSchema,
} from '../validators/purchase-order.validators';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('procurement:view'), (req, res, next) => purchaseOrderController.list(req, res, next));
router.get('/:id', requirePermissions('procurement:view'), (req, res, next) => purchaseOrderController.getById(req, res, next));

router.post('/', requirePermissions('procurement:manage'), validate(createPurchaseOrderSchema), (req, res, next) => purchaseOrderController.create(req, res, next));
router.patch('/:id/status', requirePermissions('procurement:manage'), validate(updatePOStatusSchema), (req, res, next) => purchaseOrderController.updateStatus(req, res, next));
router.put('/:id/status', requirePermissions('procurement:manage'), validate(updatePOStatusSchema), (req, res, next) => purchaseOrderController.updateStatus(req, res, next));
router.post('/:id/grn', requirePermissions('procurement:receive'), validate(grnSchema), (req, res, next) => purchaseOrderController.receiveGRN(req, res, next));
router.post('/:id/receive', requirePermissions('procurement:receive'), validate(grnSchema), (req, res, next) => purchaseOrderController.receiveGRN(req, res, next));

export default router;
