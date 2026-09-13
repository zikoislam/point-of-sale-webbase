import { Router } from 'express';
import { saleController } from '../controllers/SaleController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { requireIdempotencyKey } from '../middlewares/idempotency.middleware';
import { holdCartSchema } from '../validators/hold-cart.validators';
import { checkoutSchema, offlineSyncSchema } from '../validators/sale.validators';

const router = Router();

router.use(authenticate);

// Hold Carts (must be before /:invoiceNo)
router.get('/hold-carts', requirePermissions('pos:checkout'), (req, res, next) => saleController.listHoldCarts(req, res, next));
router.post('/hold-cart', requirePermissions('pos:checkout'), validate(holdCartSchema), (req, res, next) => saleController.holdCart(req, res, next));
router.post('/hold-carts', requirePermissions('pos:checkout'), validate(holdCartSchema), (req, res, next) => saleController.holdCart(req, res, next));
router.post('/hold-cart/:id/resume', requirePermissions('pos:checkout'), (req, res, next) => saleController.resumeCart(req, res, next));
router.post('/hold-carts/:id/resume', requirePermissions('pos:checkout'), (req, res, next) => saleController.resumeCart(req, res, next));
router.delete('/hold-cart/:id', requirePermissions('pos:checkout'), (req, res, next) => saleController.deleteHoldCart(req, res, next));
router.delete('/hold-carts/:id', requirePermissions('pos:checkout'), (req, res, next) => saleController.deleteHoldCart(req, res, next));

// Checkout & Offline Sync
router.post(
  '/checkout',
  requirePermissions('pos:checkout'),
  requireIdempotencyKey,
  validate(checkoutSchema),
  (req, res, next) => saleController.checkout(req, res, next)
);
router.post('/offline-sync', requirePermissions('pos:checkout'), validate(offlineSyncSchema), (req, res, next) => saleController.syncOffline(req, res, next));
router.post('/sync-offline', requirePermissions('pos:checkout'), validate(offlineSyncSchema), (req, res, next) => saleController.syncOffline(req, res, next));

// Lookup & Receipts
router.get('/', requirePermissions('sales:view'), (req, res, next) => saleController.list(req, res, next));
router.get('/:invoiceNo/receipt', requirePermissions('sales:view'), (req, res, next) => saleController.getReceipt(req, res, next));
router.get('/:invoiceNo', requirePermissions('sales:view'), (req, res, next) => saleController.getByInvoice(req, res, next));

export default router;
