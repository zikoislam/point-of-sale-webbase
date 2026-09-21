import { Router } from 'express';
import { syncController } from '../controllers/SyncController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/status', requirePermissions('settings:manage'), (req, res, next) =>
  syncController.status(req, res, next)
);

router.post('/run', requirePermissions('settings:manage'), (req, res, next) =>
  syncController.runNow(req, res, next)
);

export default router;
