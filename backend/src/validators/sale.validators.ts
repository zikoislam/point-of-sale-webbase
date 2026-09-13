import { z } from 'zod';

export const cartItemSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitSellingPrice: z.coerce.number().min(0).optional(), // server derives authoritative tier price
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0).optional(),
});

export const paymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'MFS_BKASH', 'MFS_NAGAD', 'STORE_CREDIT', 'CUSTOMER_DUE'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  amount: z.coerce.number().min(0, 'Payment amount cannot be negative'),
  accountId: z.string().optional(),
  transactionRef: z.string().optional(),
});

export const checkoutSchema = z.object({
  customerId: z.string().optional(),
  pricingTier: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  items: z.array(cartItemSchema).min(1, 'Cart cannot be empty'),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  payments: z.array(paymentSchema).min(1, 'At least one payment is required'),
  changeReturned: z.coerce.number().min(0).optional().default(0),
  managerPin: z.string().optional(),
  adminPassword: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const offlineSyncSchema = z.object({
  sales: z.array(checkoutSchema).min(1, 'No queued sales supplied'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OfflineSyncInput = z.infer<typeof offlineSyncSchema>;
