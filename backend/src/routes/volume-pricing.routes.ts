import { Router } from 'express';
import { z } from 'zod';
import { volumePricingController } from '../controllers/VolumePricingController';
import { requireAnyPermission, requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

const tierSchema = z.object({
  minQty: z.coerce.number().min(0),
  maxQty: z.coerce.number().min(0).nullable().optional(),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  fixedPrice: z.coerce.number().min(0).nullable().optional(),
});

const createRuleSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'ALL']).optional().default('ALL'),
  tiers: z.array(tierSchema).min(1, 'At least one tier is required'),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().max(300).optional(),
});

const updateRuleSchema = createRuleSchema.partial();

router.get('/', requirePermissions('pricing:manage'), (req, res, next) => volumePricingController.list(req, res, next));
router.post('/', requirePermissions('pricing:manage'), validate(createRuleSchema), (req, res, next) => volumePricingController.create(req, res, next));
// POS needs to preview the discount while a cart quantity changes
router.get('/applicable', requireAnyPermission('pos:checkout', 'pricing:manage', 'sales:view'), (req, res, next) => volumePricingController.applicable(req, res, next));
router.put('/:id', requirePermissions('pricing:manage'), validate(updateRuleSchema), (req, res, next) => volumePricingController.update(req, res, next));
router.delete('/:id', requirePermissions('pricing:manage'), (req, res, next) => volumePricingController.remove(req, res, next));

export default router;
