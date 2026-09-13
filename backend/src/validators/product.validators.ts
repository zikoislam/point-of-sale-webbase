import { z } from 'zod';

export const productVariantSchema = z.object({
  attributeName: z.string().trim().min(1, 'Attribute name is required'),
  sku: z.string().trim().min(1, 'SKU is required'),
  barcode: z.string().trim().optional(),
  costPrice: z.coerce.number().min(0, 'Cost price cannot be negative'),
  retailSellingPrice: z.coerce.number().min(0, 'Retail price cannot be negative'),
  wholesaleSellingPrice: z.coerce.number().min(0, 'Wholesale price cannot be negative'),
  currentStock: z.coerce.number().min(0).optional().default(0),
  alertQty: z.coerce.number().min(0).optional().default(5),
  rackLocation: z.string().trim().optional(),
  isAvailable: z.boolean().optional().default(true),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  description: z.string().trim().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  brandId: z.string().optional(),
  supplierId: z.string().optional(),
  unit: z.enum(['Pcs', 'Kg', 'Gram', 'Ltr', 'Ml', 'Box', 'Meter', 'Goj']),
  taxType: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'EXEMPT']).default('INCLUSIVE'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  variants: z.array(productVariantSchema).min(1, 'At least one variant is required'),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
