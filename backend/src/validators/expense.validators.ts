import { z } from 'zod';

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  amount: z.coerce.number().positive('Expense amount must be greater than 0'),
  accountId: z.string().min(1, 'Payment account ID is required'),
  description: z.string().trim().min(3, 'Expense description must be at least 3 characters'),
  receiptVoucherUrl: z.string().trim().optional(),
});

export const queryExpenseSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type QueryExpenseInput = z.infer<typeof queryExpenseSchema>;
