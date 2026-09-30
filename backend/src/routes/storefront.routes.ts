import { Router } from 'express';
import { z } from 'zod';
import { storefrontService } from '../services/StorefrontService';
import { sendSuccess } from '../utils/api-response';
import { runWithOrg } from '../middlewares/org.context';

/**
 * PUBLIC storefront API — no authentication. The organization is resolved from
 * the store slug, then every handler runs inside that org's tenant scope so
 * catalog and orders are always org-isolated. Mounted behind the global rate
 * limiter in index.ts.
 */
const router = Router();

const placeOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    address: z.string().trim().min(5).max(500),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.coerce.number().positive(),
      })
    )
    .min(1),
  notes: z.string().trim().max(500).optional(),
});

// Storefront page loads wrap their DB calls in the org scope explicitly.
router.get('/stores/:slug/products', async (req, res, next) => {
  try {
    const { Organization } = await import('../models/Organization');
    const org = await Organization.findOne({ slug: req.params.slug.toLowerCase(), status: 'ACTIVE' }).lean();
    if (!org) return res.status(404).json({ success: false, statusCode: 404, error: { code: 'STORE_NOT_FOUND', message: 'Store not found' } });
    const catalog = await runWithOrg({ orgId: String(org._id) }, async () => storefrontService.catalog(req.params.slug));
    sendSuccess(res, 200, 'Catalog retrieved', catalog);
  } catch (error) {
    next(error);
  }
});

router.post('/stores/:slug/orders', async (req, res, next) => {
  try {
    const parsed = placeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'INVALID_PAYLOAD', message: 'Validation failed', details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) },
      });
    }
    const { Organization } = await import('../models/Organization');
    const org = await Organization.findOne({ slug: req.params.slug.toLowerCase(), status: 'ACTIVE' }).lean();
    if (!org) return res.status(404).json({ success: false, statusCode: 404, error: { code: 'STORE_NOT_FOUND', message: 'Store not found' } });
    const result = await runWithOrg({ orgId: String(org._id) }, async () => storefrontService.placeOrder(req.params.slug, parsed.data));
    sendSuccess(res, 201, 'Order placed successfully', result);
  } catch (error) {
    next(error);
  }
});

router.get('/stores/:slug/orders/:orderNo', async (req, res, next) => {
  try {
    const phone = String(req.query.phone || '');
    if (!phone) return res.status(400).json({ success: false, statusCode: 400, error: { code: 'PHONE_REQUIRED', message: 'phone query parameter is required' } });
    const { Organization } = await import('../models/Organization');
    const org = await Organization.findOne({ slug: req.params.slug.toLowerCase(), status: 'ACTIVE' }).lean();
    if (!org) return res.status(404).json({ success: false, statusCode: 404, error: { code: 'STORE_NOT_FOUND', message: 'Store not found' } });
    const order = await runWithOrg({ orgId: String(org._id) }, async () => storefrontService.trackOrder(req.params.slug, req.params.orderNo, phone));
    sendSuccess(res, 200, 'Order retrieved', order);
  } catch (error) {
    next(error);
  }
});

export default router;
