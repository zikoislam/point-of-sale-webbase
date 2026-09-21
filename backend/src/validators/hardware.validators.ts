import { z } from 'zod';

export const printReceiptSchema = z.object({
  printerName: z.string().trim().min(1).optional(),
  docName: z.string().trim().min(1).max(120).optional(),
  bytes: z.array(z.number().int().min(0).max(255)).min(1, 'Receipt payload cannot be empty'),
});

export const cashDrawerSchema = z.object({
  printerName: z.string().trim().min(1).optional(),
});

export type PrintReceiptInput = z.infer<typeof printReceiptSchema>;
export type CashDrawerInput = z.infer<typeof cashDrawerSchema>;
