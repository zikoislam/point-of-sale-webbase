import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .toUpperCase()
    .regex(/^[A-Z_]+$/, 'Role name can only contain uppercase letters and underscores'),
  displayName: z.string().trim().min(2).max(100),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

export const updateRoleSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  permissions: z.array(z.string()).min(1).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
