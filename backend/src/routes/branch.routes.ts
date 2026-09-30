import { Router } from 'express';
import { branchController } from '../controllers/BranchController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
// Branch management is administrative; stock availability is readable by any
// member who can see inventory.
const router = Router();

router.get('/chain-dashboard', requirePermissions('reports:dashboard'), (req, res, next) =>
  branchController.chainDashboard(req, res, next)
);
router.get('/product-availability/:productId', (req, res, next) =>
  branchController.productAvailability(req, res, next)
);

router.get('/', (req, res, next) => branchController.list(req, res, next));
router.get('/:id', (req, res, next) => branchController.getById(req, res, next));
router.get('/:id/stats', (req, res, next) => branchController.stats(req, res, next));

router.post('/', requirePermissions('settings:manage'), (req, res, next) =>
  branchController.create(req, res, next)
);
router.put('/:id', requirePermissions('settings:manage'), (req, res, next) =>
  branchController.update(req, res, next)
);
router.delete('/:id', requirePermissions('settings:manage'), (req, res, next) =>
  branchController.remove(req, res, next)
);
router.put('/:id/assign-user', requirePermissions('users:manage'), (req, res, next) =>
  branchController.assignUser(req, res, next)
);

export default router;
