import { Router } from 'express';
import { productionController } from '../controllers/ProductionController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createBomSchema, updateBomSchema, createRunSchema, completeRunSchema } from '../validators/production.validators';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

// ── BOMs ───────────────────────────────────────────────────────────────────
router.get('/boms', requirePermissions('production:view'), (req, res, next) => productionController.listBoms(req, res, next));
router.post('/boms', requirePermissions('production:manage'), validate(createBomSchema), (req, res, next) => productionController.createBom(req, res, next));
router.put('/boms/:id', requirePermissions('production:manage'), validate(updateBomSchema), (req, res, next) => productionController.updateBom(req, res, next));

// ── runs ───────────────────────────────────────────────────────────────────
router.get('/runs', requirePermissions('production:view'), (req, res, next) => productionController.listRuns(req, res, next));
router.get('/runs/:id', requirePermissions('production:view'), (req, res, next) => productionController.getRun(req, res, next));
router.post('/runs', requirePermissions('production:manage'), validate(createRunSchema), (req, res, next) => productionController.createRun(req, res, next));
router.post('/runs/:id/start', requirePermissions('production:execute'), (req, res, next) => productionController.startRun(req, res, next));
router.post('/runs/:id/complete', requirePermissions('production:execute'), validate(completeRunSchema), (req, res, next) => productionController.completeRun(req, res, next));
router.post('/runs/:id/cancel', requirePermissions('production:manage'), (req, res, next) => productionController.cancelRun(req, res, next));

export default router;
