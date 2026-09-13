import { Router } from 'express';
import { supplierController } from '../controllers/SupplierController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createSupplierSchema, updateSupplierSchema } from '../validators/supplier.validators';
import { supplierDuePaymentSchema } from '../validators/supplier-ledger.validators';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('procurement:view'), (req, res, next) => supplierController.list(req, res, next));
router.get('/:id', requirePermissions('procurement:view'), (req, res, next) => supplierController.getById(req, res, next));
router.get('/:id/ledger', requirePermissions('procurement:view'), (req, res, next) => supplierController.getLedger(req, res, next));

router.post('/', requirePermissions('procurement:manage'), validate(createSupplierSchema), (req, res, next) => supplierController.create(req, res, next));
router.put('/:id', requirePermissions('procurement:manage'), validate(updateSupplierSchema), (req, res, next) => supplierController.update(req, res, next));
router.delete('/:id', requirePermissions('procurement:manage'), (req, res, next) => supplierController.delete(req, res, next));

// Supplier Due Payment / Disbursal (Phase 18)
router.post('/:id/payments', requirePermissions('procurement:pay'), validate(supplierDuePaymentSchema), (req, res, next) => supplierController.payDue(req, res, next));
router.post('/:id/pay-due', requirePermissions('procurement:pay'), validate(supplierDuePaymentSchema), (req, res, next) => supplierController.payDue(req, res, next));

export default router;

