import { Router } from 'express';
import { settingsController } from '../controllers/SettingsController';

// Public branding for the login screen — no auth, no org scope. Accepts an
// optional ?org=<slug> so a multi-tenant deployment can render each
// organization's own logo and name.
export const settingsPublicRoutes = Router();

settingsPublicRoutes.get('/public', (req, res, next) => settingsController.getPublicSettings(req, res, next));
