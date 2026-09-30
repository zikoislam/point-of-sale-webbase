import { Router } from 'express';
import { stockTransferController } from '../controllers/StockTransferController';
import { requireAnyPermission, requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/', (req, res, next) => stockTransferController.list(req, res, next));
// Incoming board (destination branch) + manager approval queue
router.get('/incoming', (req, res, next) => stockTransferController.incoming(req, res, next));
router.get('/pending-approval', requirePermissions('inv:manage'), (req, res, next) =>
  stockTransferController.pendingApproval(req, res, next)
);
router.get('/:id', (req, res, next) => stockTransferController.getById(req, res, next));

// Anyone who can see inventory may *raise* an issue request — a manager has to
// approve it before any stock actually moves.
router.post('/', requireAnyPermission('inv:manage', 'inv:view'), (req, res, next) =>
  stockTransferController.create(req, res, next)
);
// Approving an issue request is a manager action
router.put('/:id/approve', requirePermissions('inv:manage'), (req, res, next) =>
  stockTransferController.approve(req, res, next)
);
router.put('/:id/reject', requirePermissions('inv:manage'), (req, res, next) =>
  stockTransferController.reject(req, res, next)
);
router.put('/:id/send', requirePermissions('inv:manage'), (req, res, next) =>
  stockTransferController.send(req, res, next)
);
router.put('/:id/receive', requirePermissions('inv:manage'), (req, res, next) =>
  stockTransferController.receive(req, res, next)
);
router.put('/:id/cancel', requirePermissions('inv:manage'), (req, res, next) =>
  stockTransferController.cancel(req, res, next)
);

export default router;
