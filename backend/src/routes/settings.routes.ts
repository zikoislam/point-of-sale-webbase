import { Router } from 'express';
import { settingsController } from '../controllers/SettingsController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { updateSettingsSchema } from '../validators/settings.validators';

// NOTE: mounted through the org wrapper in index.ts — authentication and the
// tenant scope are applied there. The public branding endpoint lives in its
// own router (settingsPublicRoutes) that skips both.
const router = Router();

// Per-org branding for the active organization (any logged-in member)
router.get('/branding', (req, res, next) => settingsController.getBranding(req, res, next));

router.get('/', requirePermissions('settings:manage'), (req, res, next) => settingsController.getSettings(req, res, next));
router.put('/', requirePermissions('settings:manage'), validate(updateSettingsSchema), (req, res, next) => settingsController.updateSettings(req, res, next));

export default router;
