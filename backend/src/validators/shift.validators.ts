import { z } from 'zod';

export const openShiftSchema = z.object({
  openingFloat: z.coerce.number().min(0, 'Opening float cannot be negative'),
  terminalId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const pettyCashSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  reason: z.string().trim().min(1, 'Reason is required'),
});

export const closeShiftSchema = z.object({
  actualCash: z.coerce.number().min(0, 'Actual cash cannot be negative'),
  notes: z.string().trim().optional(),
  managerApprovalId: z.string().optional(),
  managerPin: z.string().optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type PettyCashInput = z.infer<typeof pettyCashSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
