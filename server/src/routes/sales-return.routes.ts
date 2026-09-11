import { Router } from 'express';
import { salesReturnController } from '../controllers/SalesReturnController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('sales:view'), (req, res, next) => salesReturnController.list(req, res, next));
router.get('/voucher/:code', requirePermissions('sales:view'), (req, res, next) => salesReturnController.validateVoucher(req, res, next));
router.get('/:id', requirePermissions('sales:view'), (req, res, next) => salesReturnController.getById(req, res, next));

router.post('/', requirePermissions('returns:authorize'), (req, res, next) => salesReturnController.processReturn(req, res, next));

export default router;
