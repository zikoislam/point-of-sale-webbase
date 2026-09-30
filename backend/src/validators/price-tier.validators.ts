import { z } from 'zod';

export const createPriceTierSchema = z.object({
  name: z.string().trim().min(1, 'Tier name is required').max(60),
  discountPercent: z.coerce.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100'),
  priority: z.coerce.number().int().min(0).default(0),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updatePriceTierSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  priority: z.coerce.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreatePriceTierInput = z.infer<typeof createPriceTierSchema>;
export type UpdatePriceTierInput = z.infer<typeof updatePriceTierSchema>;
