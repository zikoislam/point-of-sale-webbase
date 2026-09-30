import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/pnl', requirePermissions('reports:pnl'), (req, res, next) =>
  projectController.profitAndLoss(req, res, next)
);

router.get('/', (req, res, next) => projectController.list(req, res, next));
router.post('/', requirePermissions('settings:manage'), (req, res, next) =>
  projectController.create(req, res, next)
);
router.get('/:id', (req, res, next) => projectController.getById(req, res, next));
router.put('/:id', requirePermissions('settings:manage'), (req, res, next) =>
  projectController.update(req, res, next)
);
router.delete('/:id', requirePermissions('settings:manage'), (req, res, next) =>
  projectController.remove(req, res, next)
);

export default router;
