import { z } from 'zod';

export const createSupplierSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name must be at least 2 characters'),
  contactPerson: z.string().trim().min(2, 'Contact person name must be at least 2 characters'),
  phone: z.string().trim().min(8, 'Valid phone number required'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().trim().optional(),
});

export const updateSupplierSchema = z.object({
  companyName: z.string().trim().min(2).optional(),
  contactPerson: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(8).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  address: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
