import { z } from 'zod';

export const customerDuePaymentSchema = z
  .object({
    amount: z.coerce.number().positive('Payment amount must be greater than 0').optional(),
    amountPaid: z.coerce.number().positive('Payment amount must be greater than 0').optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'MFS_BKASH', 'MFS_NAGAD', 'STORE_CREDIT'], {
      errorMap: () => ({ message: 'Invalid payment method' }),
    }),
    paymentAccountId: z.string().optional(),
    accountId: z.string().optional(),
    narration: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .transform((val) => ({
    amount: (val.amount ?? val.amountPaid) as number,
    paymentMethod: val.paymentMethod,
    paymentAccountId: val.paymentAccountId ?? val.accountId,
    narration: val.narration ?? val.notes,
  }))
  .refine((val) => val.amount !== undefined && val.amount > 0, {
    message: 'Payment amount must be greater than 0',
    path: ['amount'],
  });

export const customerLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CustomerDuePaymentInput = z.infer<typeof customerDuePaymentSchema>;
export type CustomerLedgerQueryInput = z.infer<typeof customerLedgerQuerySchema>;
