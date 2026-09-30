import { Router } from 'express';
import { z } from 'zod';
import { purchaseReturnController } from '../controllers/PurchaseReturnController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

const createReturnSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.coerce.number().positive('Quantity must be greater than zero'),
        reason: z.string().trim().min(1, 'A reason is required').max(200),
        unitCost: z.coerce.number().min(0).optional(),
      })
    )
    .min(1, 'Select at least one item to return'),
  refundMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_NOTE', 'ADJUSTED_AGAINST_PAYABLE']).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'REFUNDED']).optional(),
  notes: z.string().trim().max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'CONFIRMED', 'REFUNDED']),
});

router.post('/', requirePermissions('procurement:manage'), validate(createReturnSchema), (req, res, next) => purchaseReturnController.create(req, res, next));
router.get('/', requirePermissions('procurement:view'), (req, res, next) => purchaseReturnController.list(req, res, next));
router.get('/:id', requirePermissions('procurement:view'), (req, res, next) => purchaseReturnController.getById(req, res, next));
router.put('/:id/status', requirePermissions('procurement:manage'), validate(updateStatusSchema), (req, res, next) => purchaseReturnController.updateStatus(req, res, next));

export default router;
