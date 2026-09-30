import { z } from 'zod';

const objectIdField = z
  .string()
  .refine((v) => v === '' || /^[a-f\d]{24}$/i.test(v), 'Invalid ID')
  .optional();

export const createProductGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(80),
  description: z.string().trim().max(500).optional(),
  parentGroupId: objectIdField,
  isActive: z.boolean().optional(),
});

export const updateProductGroupSchema = createProductGroupSchema.partial();

export type CreateProductGroupInput = z.infer<typeof createProductGroupSchema>;
export type UpdateProductGroupInput = z.infer<typeof updateProductGroupSchema>;
