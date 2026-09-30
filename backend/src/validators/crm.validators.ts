import { z } from 'zod';

export const loyaltyTierSchema = z.object({
  name: z.string().trim().min(1).max(30),
  minLifetimePoints: z.coerce.number().min(0),
  bonusMultiplier: z.coerce.number().min(1).max(10),
});

export const updateLoyaltyConfigSchema = z.object({
  pointsPerTk: z.coerce.number().min(0).max(10).optional(),
  redeemValuePerPoint: z.coerce.number().min(0).max(1000).optional(),
  minPointsToRedeem: z.coerce.number().min(0).optional(),
  /** Never let points pay for more than this share of a bill. */
  maxRedeemPercent: z.coerce.number().min(0).max(100).optional(),
  /** 0 = points never expire. */
  expiryDays: z.coerce.number().int().min(0).max(3650).optional(),
  tiers: z.array(loyaltyTierSchema).max(8).optional(),
  isActive: z.boolean().optional(),
});

export const createActivitySchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(['CALL', 'VISIT', 'NOTE', 'TASK', 'COMPLAINT']),
  subject: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
  dueDate: z.string().datetime().optional(),
  assignedToUserId: z.string().optional(),
});

export const activityActionSchema = z.object({
  action: z.enum(['DONE', 'REOPEN']),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.enum(['SMS', 'WHATSAPP', 'PHONE', 'EMAIL']),
  segment: z
    .object({
      customerType: z.enum(['RETAIL', 'WHOLESALE', 'DEALER']).optional(),
      minPurchases: z.coerce.number().min(0).optional(),
      minSpend: z.coerce.number().min(0).optional(),
      inactiveDays: z.coerce.number().min(0).optional(),
    })
    .optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  message: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const campaignActionSchema = z.object({
  action: z.enum(['RUN', 'COMPLETE', 'CANCEL']),
});

export type UpdateLoyaltyConfigInput = z.infer<typeof updateLoyaltyConfigSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
