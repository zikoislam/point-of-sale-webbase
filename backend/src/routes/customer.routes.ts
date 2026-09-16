import { Router } from 'express';
import { customerController } from '../controllers/CustomerController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { customerDuePaymentSchema } from '../validators/customer-ledger.validators';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.validators';
import { editCustomerLedgerSchema } from '../validators/customer-ledger.validators';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('customers:view'), (req, res, next) => customerController.list(req, res, next));
router.get('/:id', requirePermissions('customers:view'), (req, res, next) => customerController.getById(req, res, next));
router.get('/:id/ledger', requirePermissions('customers:view'), (req, res, next) => customerController.getLedger(req, res, next));

router.post('/', requirePermissions('customers:create'), validate(createCustomerSchema), (req, res, next) => customerController.create(req, res, next));
router.put('/:id', requirePermissions('customers:manage'), validate(updateCustomerSchema), (req, res, next) => customerController.update(req, res, next));
router.delete('/:id', requirePermissions('customers:manage'), (req, res, next) => customerController.delete(req, res, next));

router.post('/:id/pay-due', requirePermissions('customers:pay_due'), validate(customerDuePaymentSchema), (req, res, next) => customerController.collectPayment(req, res, next));

// Super admin specific route
router.put('/:id/ledger/:ledgerId', validate(editCustomerLedgerSchema), (req, res, next) => customerController.editLedger(req, res, next));

export default router;
