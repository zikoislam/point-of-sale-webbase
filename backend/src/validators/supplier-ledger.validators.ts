import { z } from 'zod';

export const supplierDuePaymentSchema = z.object({
  amount: z.coerce.number().positive('Disbursal amount must be greater than 0'),
  accountId: z.string().min(1, 'Payment account ID is required'),
  notes: z.string().trim().optional(),
});

export const supplierLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type SupplierDuePaymentInput = z.infer<typeof supplierDuePaymentSchema>;
export type SupplierLedgerQueryInput = z.infer<typeof supplierLedgerQuerySchema>;
