import { Router } from 'express';
import { priceTierController } from '../controllers/PriceTierController';
import { requireAnyPermission, requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createPriceTierSchema, updatePriceTierSchema } from '../validators/price-tier.validators';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

// Listing needs only read access so POS/customer forms can load tiers.
router.get('/', requireAnyPermission('customers:view', 'inv:view'), (req, res, next) => priceTierController.list(req, res, next));
router.post('/', requirePermissions('pricing:manage'), validate(createPriceTierSchema), (req, res, next) => priceTierController.create(req, res, next));
router.put('/:id', requirePermissions('pricing:manage'), validate(updatePriceTierSchema), (req, res, next) => priceTierController.update(req, res, next));
router.delete('/:id', requirePermissions('pricing:manage'), (req, res, next) => priceTierController.remove(req, res, next));

export default router;
