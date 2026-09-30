import { Router } from 'express';
import { courierController } from '../controllers/CourierController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts,
// except for the webhook routes which are mounted publicly in index.ts.
const router = Router();

router.get('/providers', requirePermissions('ecom:view'), (req, res, next) => courierController.providers(req, res, next));
router.get('/stats', requirePermissions('ecom:view'), (req, res, next) => courierController.stats(req, res, next));
router.get('/shipments', requirePermissions('ecom:view'), (req, res, next) => courierController.listShipments(req, res, next));

router.post('/shipments/:orderId', requirePermissions('ecom:manage'), (req, res, next) =>
  courierController.createShipment(req, res, next)
);
router.put('/shipments/:orderId/status', requirePermissions('ecom:manage'), (req, res, next) =>
  courierController.updateStatus(req, res, next)
);

export default router;
