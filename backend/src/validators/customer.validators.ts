import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().min(6, 'Phone number is required'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative').optional().default(0),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().min(6).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  loyaltyPoints: z.coerce.number().min(0, 'Loyalty points cannot be negative').optional(),
  isActive: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
