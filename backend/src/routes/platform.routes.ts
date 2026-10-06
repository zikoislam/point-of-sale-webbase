import { Router } from 'express';
import { z } from 'zod';
import { orgController } from '../controllers/OrgController';
import { licenseController } from '../controllers/LicenseController';
import { planController } from '../controllers/PlanController';
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

const generateLicenseSchema = z
  .object({
    days: z.number().int().positive().max(3650).optional(),
    planId: z.string().optional(),
    plan: z.string().max(60).optional(),
    note: z.string().max(300).optional(),
    machineId: z.string().max(64).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((d) => d.days !== undefined || d.planId !== undefined, {
    message: 'Provide either days or planId',
  });

const extendSubscriptionSchema = z.object({
  days: z.number().int().positive().max(3650),
  plan: z.string().max(60).optional(),
  note: z.string().max(300).optional(),
});

const createPlanSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(40),
  durationDays: z.number().int().positive().max(3650),
  price: z.number().min(0).optional(),
  description: z.string().max(300).optional(),
  features: z.array(z.string().max(80)).max(50).optional(),
  permissionSet: permissionsSchema.optional(),
  applyPermissions: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updatePlanSchema = createPlanSchema.partial().extend({ isActive: z.boolean().optional() });

router.get('/orgs', (req, res, next) => orgController.listOrgs(req, res, next));
router.post('/orgs', validate(createOrgSchema), (req, res, next) => orgController.createOrg(req, res, next));

// Plans (platform-global): the Super Admin defines Plan 1/2/3 (duration, price,
// features and the permission envelope a key from that plan grants).
router.get('/plans', (req, res, next) => planController.list(req, res, next));
router.post('/plans', validate(createPlanSchema), (req, res, next) => planController.create(req, res, next));
router.patch('/plans/:id', validate(updatePlanSchema), (req, res, next) => planController.update(req, res, next));
router.post('/plans/:id/toggle', (req, res, next) => planController.toggle(req, res, next));

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
