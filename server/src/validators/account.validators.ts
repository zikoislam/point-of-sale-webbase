import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().trim().min(2, 'Account name must be at least 2 characters'),
  accountType: z.enum(['CASH', 'BANK', 'MFS'], {
    errorMap: () => ({ message: 'Account type must be CASH, BANK, or MFS' }),
  }),
  accountNumber: z.string().trim().optional(),
  initialBalance: z.coerce.number().min(0, 'Initial balance cannot be negative').default(0),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2).optional(),
  accountNumber: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const transferFundsSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amount: z.coerce.number().positive('Transfer amount must be greater than 0'),
  description: z.string().trim().min(3, 'Transfer description must be at least 3 characters'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type TransferFundsInput = z.infer<typeof transferFundsSchema>;
