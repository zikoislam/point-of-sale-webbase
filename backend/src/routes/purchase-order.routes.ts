import { Router } from 'express';
import { z } from 'zod';
import { purchaseOrderController } from '../controllers/PurchaseOrderController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyPermission, requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createPurchaseOrderSchema,
  grnSchema,
  updatePOStatusSchema,
} from '../validators/purchase-order.validators';

const rejectPOSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required').max(300),
});

const router = Router();



router.get('/', requirePermissions('procurement:view'), (req, res, next) => purchaseOrderController.list(req, res, next));
// Must come before /:id, otherwise "pending-receive" is read as an id
router.get('/pending-receive', requirePermissions('procurement:receive'), (req, res, next) =>
  purchaseOrderController.pendingReceive(req, res, next)
);
router.get('/:id', requirePermissions('procurement:view'), (req, res, next) => purchaseOrderController.getById(req, res, next));

router.post('/', requirePermissions('procurement:manage'), validate(createPurchaseOrderSchema), (req, res, next) => purchaseOrderController.create(req, res, next));
router.patch('/:id/status', requirePermissions('procurement:manage'), validate(updatePOStatusSchema), (req, res, next) => purchaseOrderController.updateStatus(req, res, next));
router.put('/:id/status', requirePermissions('procurement:manage'), validate(updatePOStatusSchema), (req, res, next) => purchaseOrderController.updateStatus(req, res, next));
// Receive worklist + full manual receive
router.post('/:id/receive-full', requirePermissions('procurement:receive'), (req, res, next) =>
  purchaseOrderController.receiveFull(req, res, next)
);
router.post('/:id/receive', requirePermissions('procurement:receive'), validate(grnSchema), (req, res, next) => purchaseOrderController.receiveGRN(req, res, next));
// Kept as an alias — older clients and the Postman collection post to /grn
router.post('/:id/grn', requirePermissions('procurement:receive'), validate(grnSchema), (req, res, next) => purchaseOrderController.receiveGRN(req, res, next));
// Approval workflow — manager / admin
router.put('/:id/approve', requireAnyPermission('approvals:manage', 'procurement:manage'), (req, res, next) => purchaseOrderController.approve(req, res, next));
router.put('/:id/reject', requireAnyPermission('approvals:manage', 'procurement:manage'), validate(rejectPOSchema), (req, res, next) => purchaseOrderController.reject(req, res, next));

export default router;
