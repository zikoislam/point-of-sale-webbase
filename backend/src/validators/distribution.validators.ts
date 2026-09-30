import { z } from 'zod';

export const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(20),
  description: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const updateZoneSchema = createZoneSchema.partial();

export const ROUTE_DAY_VALUES = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export const createRouteSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(20),
  areas: z.string().trim().max(300).optional(),
  daysOfWeek: z.array(z.enum(ROUTE_DAY_VALUES)).max(7).optional(),
  assignedSRId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateRouteSchema = createRouteSchema.partial();

export const createSalesRepSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  userId: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
  commissionPercent: z.coerce.number().min(0).max(100).default(0),
  monthlyTargetAmount: z.coerce.number().min(0).default(0),
  address: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const updateSalesRepSchema = createSalesRepSchema.partial();

export const createSrOrderSchema = z.object({
  repId: z.string().min(1),
  customerId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().min(0).optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

export const srOrderActionSchema = z.object({
  action: z.enum(['CONFIRM', 'CANCEL']),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type CreateSalesRepInput = z.infer<typeof createSalesRepSchema>;
export type UpdateSalesRepInput = z.infer<typeof updateSalesRepSchema>;
export type CreateSrOrderInput = z.infer<typeof createSrOrderSchema>;
