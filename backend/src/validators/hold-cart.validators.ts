import { z } from 'zod';

export const holdCartItemSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitSellingPrice: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0).optional(),
  // Optional snapshot fields (accepted for compatibility; server re-derives them)
  productName: z.string().optional(),
  variantName: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  lineTotal: z.coerce.number().min(0).optional(),
});

export const holdCartSchema = z.object({
  cartLabel: z.string().trim().min(1).optional(),
  customerId: z.string().optional(),
  pricingTier: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  items: z.array(holdCartItemSchema).min(1, 'Hold cart must contain at least one item'),
  subtotal: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  totalAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional(),
});

export type HoldCartInput = z.infer<typeof holdCartSchema>;
