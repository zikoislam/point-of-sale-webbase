import { Router } from 'express';
import { approvalController } from '../controllers/ApprovalController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
// Any member may see their own requests; acting on them is checked per level
// inside the service (role or named approver), so no blanket permission here.
const router = Router();

router.get('/inbox', (req, res, next) => approvalController.inbox(req, res, next));
router.get('/report/pending', requirePermissions('reports:dashboard'), (req, res, next) =>
  approvalController.pendingReport(req, res, next)
);

// Workflow configuration (administrative)
router.get('/workflows', (req, res, next) => approvalController.listWorkflows(req, res, next));
router.post('/workflows', requirePermissions('settings:manage'), (req, res, next) =>
  approvalController.createWorkflow(req, res, next)
);
router.get('/workflows/:id', (req, res, next) => approvalController.getWorkflow(req, res, next));
router.put('/workflows/:id', requirePermissions('settings:manage'), (req, res, next) =>
  approvalController.updateWorkflow(req, res, next)
);
router.delete('/workflows/:id', requirePermissions('settings:manage'), (req, res, next) =>
  approvalController.removeWorkflow(req, res, next)
);

// Requests
router.get('/', (req, res, next) => approvalController.listRequests(req, res, next));
router.post('/', requirePermissions('procurement:manage'), (req, res, next) =>
  approvalController.submit(req, res, next)
);
router.get('/:id', (req, res, next) => approvalController.getRequest(req, res, next));
router.put('/:id/approve', (req, res, next) => approvalController.approve(req, res, next));
router.put('/:id/reject', (req, res, next) => approvalController.reject(req, res, next));
router.put('/:id/cancel', (req, res, next) => approvalController.cancel(req, res, next));

export default router;
