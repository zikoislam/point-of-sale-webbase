import { Router } from 'express';
import { saleController } from '../controllers/SaleController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { holdCartSchema } from '../validators/hold-cart.validators';

const router = Router();

router.use(authenticate);

// Hold Carts (must be before /:invoiceNo)
router.get('/hold-carts', requirePermissions('pos:checkout'), (req, res, next) => saleController.listHoldCarts(req, res, next));
router.post('/hold-cart', requirePermissions('pos:checkout'), validate(holdCartSchema), (req, res, next) => saleController.holdCart(req, res, next));
router.post('/hold-cart/:id/resume', requirePermissions('pos:checkout'), (req, res, next) => saleController.resumeCart(req, res, next));
router.delete('/hold-cart/:id', requirePermissions('pos:checkout'), (req, res, next) => saleController.deleteHoldCart(req, res, next));

// Checkout & Offline Sync
router.post('/checkout', requirePermissions('pos:checkout'), (req, res, next) => saleController.checkout(req, res, next));
router.post('/sync-offline', requirePermissions('pos:checkout'), (req, res, next) => saleController.syncOffline(req, res, next));

// Lookup & Receipts
router.get('/:invoiceNo/receipt', requirePermissions('sales:view'), (req, res, next) => saleController.getReceipt(req, res, next));
router.get('/:invoiceNo', requirePermissions('sales:view'), (req, res, next) => saleController.getByInvoice(req, res, next));

export default router;

