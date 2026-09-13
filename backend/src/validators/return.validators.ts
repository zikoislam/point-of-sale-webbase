import { z } from 'zod';

export const returnItemInputSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.coerce.number().positive('Return quantity must be greater than 0'),
  unitRefundPrice: z.coerce.number().min(0).optional(),
  isResaleable: z.boolean().default(true),
});

export const processReturnSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  items: z.array(returnItemInputSchema).min(1, 'At least one item must be returned'),
  refundType: z.enum(['CASH', 'STORE_CREDIT', 'CARD_REVERSAL']),
  reason: z.string().trim().min(1, 'Return reason is required'),
  managerPin: z.string().min(4, 'Manager PIN is required to authorise a return'),
});

export type ProcessReturnInput = z.infer<typeof processReturnSchema>;
