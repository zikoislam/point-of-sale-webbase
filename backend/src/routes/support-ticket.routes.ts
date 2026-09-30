import { Router } from 'express';
import { supportTicketController } from '../controllers/SupportTicketController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/report/sla', requirePermissions('crm:view'), (req, res, next) =>
  supportTicketController.slaReport(req, res, next)
);

router.get('/', requirePermissions('crm:view'), (req, res, next) => supportTicketController.list(req, res, next));
router.post('/', requirePermissions('crm:manage'), (req, res, next) => supportTicketController.create(req, res, next));
router.get('/:id', requirePermissions('crm:view'), (req, res, next) => supportTicketController.getById(req, res, next));
router.put('/:id', requirePermissions('crm:manage'), (req, res, next) => supportTicketController.update(req, res, next));
router.post('/:id/responses', requirePermissions('crm:manage'), (req, res, next) =>
  supportTicketController.addResponse(req, res, next)
);
router.post('/:id/resolve', requirePermissions('crm:manage'), (req, res, next) =>
  supportTicketController.resolve(req, res, next)
);

export default router;
