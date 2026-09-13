import { Router } from 'express';
import { settingsController } from '../controllers/SettingsController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { updateSettingsSchema } from '../validators/settings.validators';

const router = Router();

// Public branding (shop name + logo) — no auth, used by login/sidebar
router.get('/public', (req, res, next) => settingsController.getPublicSettings(req, res, next));

router.use(authenticate);
router.get('/', requirePermissions('settings:manage'), (req, res, next) => settingsController.getSettings(req, res, next));
router.put('/', requirePermissions('settings:manage'), validate(updateSettingsSchema), (req, res, next) => settingsController.updateSettings(req, res, next));
export default router;

