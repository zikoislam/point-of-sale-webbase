import { z } from 'zod';

export const poItemSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  productName: z.string().trim().min(1, 'Product name is required'),
  sku: z.string().trim().min(1, 'SKU is required'),
  orderedQty: z.coerce.number().positive('Ordered quantity must be greater than 0'),
  unitCost: z.coerce.number().min(0, 'Unit cost cannot be negative'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  items: z.array(poItemSchema).min(1, 'Purchase order must contain at least one item'),
  taxAmount: z.coerce.number().min(0).optional().default(0),
  shippingCost: z.coerce.number().min(0).optional().default(0),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().trim().optional(),
});

export const grnItemSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  receivedQty: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0).optional(),
  batchNo: z.string().trim().optional(),
  expiryDate: z.string().optional(),
});

export const grnSchema = z.object({
  vendorInvoiceNo: z.string().trim().optional(),
  items: z.array(grnItemSchema).min(1, 'GRN must contain at least one item'),
  paidNow: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().optional(),
});

export const updatePOStatusSchema = z.object({
  status: z.enum(['ORDERED', 'CANCELLED']),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type GRNInput = z.infer<typeof grnSchema>;
