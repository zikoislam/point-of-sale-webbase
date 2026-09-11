import { z } from 'zod';

export const queryAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entity: z.string().trim().optional(),
  action: z
    .enum(['CREATE', 'UPDATE', 'DELETE', 'PRICE_OVERRIDE', 'OFFLINE_OVERSELL', 'SHIFT_DISCREPANCY'])
    .optional(),
  userId: z.string().optional(),
});

export type QueryAuditLogsInput = z.infer<typeof queryAuditLogsSchema>;
