import { Router } from 'express';
import { leadController } from '../controllers/LeadController';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/board', requirePermissions('crm:view'), (req, res, next) => leadController.board(req, res, next));
router.get('/report/conversion', requirePermissions('crm:view'), (req, res, next) =>
  leadController.conversionReport(req, res, next)
);

router.get('/', requirePermissions('crm:view'), (req, res, next) => leadController.list(req, res, next));
router.post('/', requirePermissions('crm:manage'), (req, res, next) => leadController.create(req, res, next));
router.get('/:id', requirePermissions('crm:view'), (req, res, next) => leadController.getById(req, res, next));
router.put('/:id', requirePermissions('crm:manage'), (req, res, next) => leadController.update(req, res, next));
router.put('/:id/stage', requirePermissions('crm:manage'), (req, res, next) => leadController.moveStage(req, res, next));
router.post('/:id/follow-up', requirePermissions('crm:manage'), (req, res, next) => leadController.followUp(req, res, next));
router.post('/:id/convert', requirePermissions('crm:manage'), (req, res, next) => leadController.convert(req, res, next));
router.delete('/:id', requirePermissions('crm:manage'), (req, res, next) => leadController.remove(req, res, next));

export default router;
