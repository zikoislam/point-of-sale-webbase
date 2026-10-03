import { Router } from 'express';
import { z } from 'zod';
import { orgController } from '../controllers/OrgController';
import { licenseController } from '../controllers/LicenseController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePlatformSuperAdmin } from '../middlewares/org.middleware';
import { validate } from '../middlewares/validation.middleware';
import { ALL_PERMISSIONS } from '../config/permissions';

const router = Router();

// Everything here is platform-level: only the Super Admin, and none of it is
// tenant-scoped (the middleware runs with scoping disabled).
router.use(authenticate);
router.use(requirePlatformSuperAdmin);

const permissionsSchema = z
  .array(z.string().refine((p) => ALL_PERMISSIONS.includes(p), { message: 'Unknown permission' }))
  .min(0);

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  contactPhone: z.string().max(30).optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().max(300).optional(),
  adminPermissionSet: permissionsSchema,
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  contactPhone: z.string().max(30).optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().max(300).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

const setPermissionsSchema = z.object({
  adminPermissionSet: permissionsSchema,
});

const addMemberSchema = z.object({
  userId: z.string().optional(),
  username: z.string().optional(),
  roleId: z.string().min(1),
});

const setMemberActiveSchema = z.object({
  isActive: z.boolean(),
});

const generateLicenseSchema = z.object({
  days: z.number().int().positive().max(3650),
  plan: z.string().max(60).optional(),
  note: z.string().max(300).optional(),
  machineId: z.string().max(64).optional(),
  expiresAt: z.string().datetime().optional(),
});

const extendSubscriptionSchema = z.object({
  days: z.number().int().positive().max(3650),
  plan: z.string().max(60).optional(),
  note: z.string().max(300).optional(),
});

router.get('/orgs', (req, res, next) => orgController.listOrgs(req, res, next));
router.post('/orgs', validate(createOrgSchema), (req, res, next) => orgController.createOrg(req, res, next));
router.patch('/orgs/:id', validate(updateOrgSchema), (req, res, next) => orgController.updateOrg(req, res, next));
router.put('/orgs/:id/permissions', validate(setPermissionsSchema), (req, res, next) => orgController.setPermissions(req, res, next));
router.post('/orgs/:id/members', validate(addMemberSchema), (req, res, next) => orgController.addMember(req, res, next));
router.patch('/orgs/:id/members/:userId', validate(setMemberActiveSchema), (req, res, next) => orgController.setMemberActive(req, res, next));
router.post('/orgs/:id/enter', (req, res, next) => orgController.enterOrg(req, res, next));
router.get('/orgs/:id/summary', (req, res, next) => orgController.getSummary(req, res, next));

// Subscription & license management (Super Admin issues keys; the org admin
// redeems them from the Software Locked page).
router.patch(
  '/orgs/:id/subscription',
  validate(extendSubscriptionSchema),
  (req, res, next) => licenseController.extendSubscription(req, res, next)
);
router.post(
  '/orgs/:id/licenses',
  validate(generateLicenseSchema),
  (req, res, next) => licenseController.generateKey(req, res, next)
);
router.get('/orgs/:id/licenses', (req, res, next) => licenseController.listKeys(req, res, next));
router.post('/licenses/:keyId/revoke', (req, res, next) => licenseController.revokeKey(req, res, next));

export default router;
