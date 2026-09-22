import { z } from 'zod';

export const updateSettingsSchema = z.object({
  shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters').optional(),
  shopAddress: z.string().trim().optional(),
  shopPhone: z.string().trim().optional(),
  shopEmail: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  currencySymbol: z.string().trim().min(1).max(5).optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  allowNegativeStock: z.boolean().optional(),
  thermalPrinterType: z.enum(['58mm', '80mm']).optional(),
  memoPrintMode: z.enum(['thermal', 'a4', 'custom']).optional(),
  memoWidthMm: z.coerce.number().min(20).max(1000).optional(),
  memoHeightMm: z.coerce.number().min(20).max(1000).optional(),
  barcodeLabelFormat: z.string().trim().optional(),
  cashDrawerTriggerCode: z.string().optional(),
  receiptHeader: z.string().trim().optional(),
  receiptFooter: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
