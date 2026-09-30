import { Router } from 'express';
import { crmController } from '../controllers/CrmController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  updateLoyaltyConfigSchema,
  createActivitySchema,
  activityActionSchema,
  createCampaignSchema,
  campaignActionSchema,
} from '../validators/crm.validators';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

// ── loyalty ────────────────────────────────────────────────────────────────
router.get('/loyalty', requirePermissions('crm:view'), (req, res, next) => crmController.getLoyaltyConfig(req, res, next));
router.put('/loyalty', requirePermissions('crm:loyalty'), validate(updateLoyaltyConfigSchema), (req, res, next) => crmController.updateLoyaltyConfig(req, res, next));
router.get('/loyalty/pos', requirePermissions('pos:checkout'), (req, res, next) => crmController.loyaltyForPos(req, res, next));
router.get('/loyalty/report', requirePermissions('crm:view'), (req, res, next) => crmController.loyaltyReport(req, res, next));
router.get('/loyalty/customer/:customerId', requirePermissions('crm:view'), (req, res, next) => crmController.loyaltyStatement(req, res, next));
router.get('/loyalty/analytics', requirePermissions('crm:view'), (req, res, next) => crmController.loyaltyAnalytics(req, res, next));
router.post('/loyalty/expire', requirePermissions('crm:loyalty'), (req, res, next) => crmController.expireLoyaltyPoints(req, res, next));

// ── activities / follow-ups ───────────────────────────────────────────────
router.get('/activities', requirePermissions('crm:view'), (req, res, next) => crmController.listActivities(req, res, next));
router.post('/activities', requirePermissions('crm:manage'), validate(createActivitySchema), (req, res, next) => crmController.createActivity(req, res, next));
router.patch('/activities/:id/status', requirePermissions('crm:manage'), validate(activityActionSchema), (req, res, next) => crmController.setActivityStatus(req, res, next));
router.get('/customers/:customerId/activities', requirePermissions('crm:view'), (req, res, next) => crmController.customerTimeline(req, res, next));

// ── campaigns ──────────────────────────────────────────────────────────────
router.get('/campaigns', requirePermissions('crm:view'), (req, res, next) => crmController.listCampaigns(req, res, next));
router.post('/campaigns', requirePermissions('crm:manage'), validate(createCampaignSchema), (req, res, next) => crmController.createCampaign(req, res, next));
router.patch('/campaigns/:id/status', requirePermissions('crm:manage'), validate(campaignActionSchema), (req, res, next) => crmController.setCampaignStatus(req, res, next));
router.get('/campaigns/:id/audience', requirePermissions('crm:view'), (req, res, next) => crmController.campaignAudience(req, res, next));

export default router;
