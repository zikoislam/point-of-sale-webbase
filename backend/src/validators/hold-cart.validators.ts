import { z } from 'zod';

export const holdCartItemSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  variantName: z.string().optional().default('Default'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitSellingPrice: z.coerce.number().min(0, 'Selling price cannot be negative'),
  taxRate: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  lineTotal: z.coerce.number().min(0, 'Line total cannot be negative'),
});

export const holdCartSchema = z.object({
  cartLabel: z.string().trim().min(1, 'Cart label is required'),
  customerId: z.string().optional(),
  pricingTier: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  items: z.array(holdCartItemSchema).min(1, 'Hold cart must contain at least one item'),
  subtotal: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0),
  notes: z.string().trim().optional(),
});

export type HoldCartInput = z.infer<typeof holdCartSchema>;
