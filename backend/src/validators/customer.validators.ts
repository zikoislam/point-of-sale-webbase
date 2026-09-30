import { z } from 'zod';

const priceTierField = z
  .string()
  .refine((v) => v === '' || /^[a-f\d]{24}$/i.test(v), 'Invalid price tier')
  .optional();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().min(6, 'Phone number is required'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  taxId: z.string().trim().max(30).optional(),
  address: z.string().trim().optional(),
  priceTierId: priceTierField,
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DEALER']).optional(),
  routeId: priceTierField, // same ObjectId shape
  assignedSRId: priceTierField,
  creditDays: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative').optional().default(0),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().min(6).optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  taxId: z.string().trim().max(30).optional(),
  address: z.string().trim().optional(),
  priceTierId: priceTierField,
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DEALER']).optional(),
  routeId: priceTierField,
  assignedSRId: priceTierField,
  creditDays: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  loyaltyPoints: z.coerce.number().min(0, 'Loyalty points cannot be negative').optional(),
  isActive: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
