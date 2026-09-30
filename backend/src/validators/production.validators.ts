import { z } from 'zod';

export const createBomSchema = z.object({
  name: z.string().trim().min(1).max(120),
  productId: z.string().min(1),
  outputQty: z.coerce.number().positive('Output quantity must be greater than zero'),
  laborCost: z.coerce.number().min(0).default(0),
  overheadCost: z.coerce.number().min(0).default(0),
  isActive: z.boolean().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        wastagePercent: z.coerce.number().min(0).max(100).default(0),
      })
    )
    .min(1, 'A BOM needs at least one component'),
});

export const updateBomSchema = createBomSchema.partial();

export const createRunSchema = z.object({
  bomId: z.string().min(1),
  plannedQty: z.coerce.number().positive('Planned quantity must be greater than zero'),
  notes: z.string().trim().max(500).optional(),
});

export const completeRunSchema = z.object({
  producedQty: z.coerce.number().positive('Produced quantity must be greater than zero'),
});

export type CreateBomInput = z.infer<typeof createBomSchema>;
export type UpdateBomInput = z.infer<typeof updateBomSchema>;
export type CreateRunInput = z.infer<typeof createRunSchema>;
