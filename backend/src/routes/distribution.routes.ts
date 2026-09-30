import { Router } from 'express';
import { distributionController } from '../controllers/DistributionController';
import { requirePermissions, requireAnyPermission } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createZoneSchema,
  updateZoneSchema,
  createRouteSchema,
  updateRouteSchema,
  createSalesRepSchema,
  updateSalesRepSchema,
  createSrOrderSchema,
  srOrderActionSchema,
} from '../validators/distribution.validators';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

// ── zones (territories) ────────────────────────────────────────────────────
router.get('/zones', requireAnyPermission('distribution:manage', 'sr:view'), (req, res, next) => distributionController.listZones(req, res, next));
router.post('/zones', requirePermissions('distribution:manage'), validate(createZoneSchema), (req, res, next) => distributionController.createZone(req, res, next));
router.put('/zones/:id', requirePermissions('distribution:manage'), validate(updateZoneSchema), (req, res, next) => distributionController.updateZone(req, res, next));
router.delete('/zones/:id', requirePermissions('distribution:manage'), (req, res, next) => distributionController.archiveZone(req, res, next));

// ── routes ─────────────────────────────────────────────────────────────────
router.get('/routes', requireAnyPermission('distribution:manage', 'sr:view'), (req, res, next) => distributionController.listRoutes(req, res, next));
router.post('/routes', requirePermissions('distribution:manage'), validate(createRouteSchema), (req, res, next) => distributionController.createRoute(req, res, next));
router.put('/routes/:id', requirePermissions('distribution:manage'), validate(updateRouteSchema), (req, res, next) => distributionController.updateRoute(req, res, next));
router.delete('/routes/:id', requirePermissions('distribution:manage'), (req, res, next) => distributionController.archiveRoute(req, res, next));
router.get('/routes/:id/customers', requireAnyPermission('distribution:manage', 'sr:view'), (req, res, next) => distributionController.routeCustomers(req, res, next));

// ── sales reps ─────────────────────────────────────────────────────────────
router.get('/reps', requirePermissions('sr:view'), (req, res, next) => distributionController.listSalesReps(req, res, next));
router.post('/reps', requirePermissions('sr:manage'), validate(createSalesRepSchema), (req, res, next) => distributionController.createSalesRep(req, res, next));
router.put('/reps/:id', requirePermissions('sr:manage'), validate(updateSalesRepSchema), (req, res, next) => distributionController.updateSalesRep(req, res, next));
router.get('/report', requirePermissions('sr:view'), (req, res, next) => distributionController.srReport(req, res, next));

// ── dealers ────────────────────────────────────────────────────────────────
router.get('/dealers', requirePermissions('dealer:manage'), (req, res, next) => distributionController.listDealers(req, res, next));

// ── SR orders ──────────────────────────────────────────────────────────────
router.get('/orders', requirePermissions('sr:view'), (req, res, next) => distributionController.listSrOrders(req, res, next));
router.post('/orders', requirePermissions('sr:operate'), validate(createSrOrderSchema), (req, res, next) => distributionController.createSrOrder(req, res, next));
router.patch('/orders/:id/action', requirePermissions('sr:manage'), validate(srOrderActionSchema), (req, res, next) => distributionController.actionSrOrder(req, res, next));
router.post('/orders/:id/convert', requirePermissions('sr:manage'), (req, res, next) => distributionController.convertSrOrder(req, res, next));

export default router;
