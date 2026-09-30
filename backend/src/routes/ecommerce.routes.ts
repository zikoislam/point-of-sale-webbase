import { Router } from 'express';
import { z } from 'zod';
import { ecommerceController } from '../controllers/EcommerceController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

const statusSchema = z.object({
  status: z.enum(['SHIPPED', 'DELIVERED', 'CANCELLED']),
  trackingCode: z.string().trim().max(80).optional(),
});

router.get('/orders', requirePermissions('ecom:view'), (req, res, next) => ecommerceController.listOrders(req, res, next));
router.get('/orders/:id', requirePermissions('ecom:view'), (req, res, next) => ecommerceController.getOrder(req, res, next));
router.post('/orders/:id/confirm', requirePermissions('ecom:manage'), (req, res, next) => ecommerceController.confirmOrder(req, res, next));
router.patch('/orders/:id/status', requirePermissions('ecom:manage'), validate(statusSchema), (req, res, next) => ecommerceController.setFulfillmentStatus(req, res, next));

export default router;
