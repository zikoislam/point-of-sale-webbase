import { Router } from 'express';
import { z } from 'zod';
import { licenseController } from '../controllers/LicenseController';
import { requireAnyPermission } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';

/**
 * Tenant-scoped subscription routes. Mounted OUTSIDE the subscription gate so a
 * locked organization can still read its state and redeem a key. `authenticate`
 * and `requireOrg` are applied at the mount point (see index.ts).
 */
const router = Router();

const redeemSchema = z.object({
  key: z.string().min(4).max(64),
  machineId: z.string().max(64).optional(),
});

router.get('/', (req, res, next) => licenseController.getSubscription(req, res, next));

// Admin-level action: the org admin redeems the key the Super Admin issued.
router.post(
  '/redeem',
  requireAnyPermission('subscription:manage', 'users:manage'),
  validate(redeemSchema),
  (req, res, next) => licenseController.redeem(req, res, next)
);

export default router;
