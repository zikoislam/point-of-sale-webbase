import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().min(10, 'Valid phone number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  roleId: z.string().min(1, 'Role is required'),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(10).optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const updatePinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePinInput = z.infer<typeof updatePinSchema>;
