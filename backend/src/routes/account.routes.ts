import { Router } from 'express';
import { accountController } from '../controllers/AccountController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createAccountSchema,
  updateAccountSchema,
  transferFundsSchema,
} from '../validators/account.validators';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('accounts:view'), (req, res, next) => accountController.list(req, res, next));
router.get('/:id', requirePermissions('accounts:view'), (req, res, next) => accountController.getById(req, res, next));
router.get('/:id/ledger', requirePermissions('accounts:view'), (req, res, next) => accountController.getLedger(req, res, next));

router.post('/', requirePermissions('accounts:manage'), validate(createAccountSchema), (req, res, next) => accountController.create(req, res, next));
router.put('/:id', requirePermissions('accounts:manage'), validate(updateAccountSchema), (req, res, next) => accountController.update(req, res, next));
router.post('/transfer', requirePermissions('accounts:transfer'), validate(transferFundsSchema), (req, res, next) => accountController.transfer(req, res, next));

export default router;
