import { z } from 'zod';

export const customerDuePaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'CARD', 'MFS_BKASH', 'MFS_NAGAD', 'STORE_CREDIT'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  notes: z.string().trim().optional(),
});

export const customerLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CustomerDuePaymentInput = z.infer<typeof customerDuePaymentSchema>;
export type CustomerLedgerQueryInput = z.infer<typeof customerLedgerQuerySchema>;
