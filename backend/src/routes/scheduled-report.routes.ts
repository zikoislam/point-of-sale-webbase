import { Router } from 'express';
import { scheduledReportController } from '../controllers/ScheduledReportController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/options', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.options(req, res, next)
);
router.get('/', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.list(req, res, next)
);
router.post('/', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.create(req, res, next)
);
router.post('/run-due', requirePermissions('settings:manage'), (req, res, next) =>
  scheduledReportController.runDue(req, res, next)
);
router.get('/:id', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.getById(req, res, next)
);
router.put('/:id', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.update(req, res, next)
);
router.put('/:id/toggle', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.toggle(req, res, next)
);
router.post('/:id/run', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.runNow(req, res, next)
);
router.delete('/:id', requirePermissions('reports:export'), (req, res, next) =>
  scheduledReportController.remove(req, res, next)
);

export default router;
