import { Router } from 'express';
import { salesReturnController } from '../controllers/SalesReturnController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/:code', requirePermissions('pos:checkout'), (req, res, next) => salesReturnController.validateVoucher(req, res, next));

export default router;
