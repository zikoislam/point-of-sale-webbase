import { Router } from 'express';
import { wastageController } from '../controllers/WastageController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('inv:view'), (req, res, next) => wastageController.list(req, res, next));
router.post('/adjust', requirePermissions('inv:adjust'), (req, res, next) => wastageController.record(req, res, next));

export default router;
