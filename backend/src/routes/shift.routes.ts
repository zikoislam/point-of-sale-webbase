import { Router } from 'express';
import { shiftController } from '../controllers/ShiftController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/active', requirePermissions('shifts:operate'), (req, res, next) => shiftController.getActive(req, res, next));
router.get('/', requirePermissions('shifts:view'), (req, res, next) => shiftController.list(req, res, next));
router.get('/:id/z-report', requirePermissions('shifts:view'), (req, res, next) => shiftController.getZReport(req, res, next));

router.post('/open', requirePermissions('shifts:operate'), (req, res, next) => shiftController.open(req, res, next));
router.post('/:id/petty-cash', requirePermissions('shifts:operate'), (req, res, next) => shiftController.addPettyCash(req, res, next));
router.post('/:id/close', requirePermissions('shifts:operate'), (req, res, next) => shiftController.close(req, res, next));

export default router;
