import { z } from 'zod';

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters'),
  code: z
    .string()
    .trim()
    .min(2, 'Category code must be at least 2 characters')
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens, and underscores'),
});

export const updateExpenseCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
