import { loyaltyService } from '../services/LoyaltyService';

/**
 * Loyalty points expiry (Phase 9.1).
 *
 * Only does work when the organisation has switched expiry on (`expiryDays > 0`),
 * and each organisation is entered in its own tenant scope inside the service —
 * the cron tick itself runs outside any request.
 */
export const runLoyaltyExpirySweep = async (): Promise<{ customers: number; points: number; orgs: number }> => {
  const result = await loyaltyService.expirePoints();
  if (result.points > 0) {
    console.log(
      `🎫 [CRON] Loyalty expiry: ${result.points} point(s) expired across ${result.customers} customer(s)`
    );
  }
  return result;
};
