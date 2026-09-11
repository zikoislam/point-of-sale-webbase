import { HoldCart } from '../models/HoldCart';

export const cleanupExpiredHoldCarts = async (): Promise<number> => {
  console.log('🧹 [CRON] Cleaning up expired hold carts (TTL verification)...');
  const now = new Date();
  const result = await HoldCart.deleteMany({ expiresAt: { $lte: now } });
  console.log(`✅ [CRON] Expired hold carts cleanup complete. Deleted: ${result.deletedCount || 0}`);
  return result.deletedCount || 0;
};
