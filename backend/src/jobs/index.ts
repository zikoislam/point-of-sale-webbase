import cron from 'node-cron';
import { runDailySummaryJob } from './daily-summary.job';
import { cleanupExpiredHoldCarts } from './expired-cart-cleanup';
import { scanFefoExpiryAlerts } from './fefo-expiry-scan';

export const initJobs = (): void => {
  // 1. Daily Materialized Sales Summary: Midnight 00:05 AM
  cron.schedule('5 0 * * *', async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await runDailySummaryJob(yesterday);
    } catch (e) {
      console.error('❌ [CRON] Daily summary job failed:', e);
    }
  });

  // 2. Expired Hold Carts Cleanup: Every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      await cleanupExpiredHoldCarts();
    } catch (e) {
      console.error('❌ [CRON] Hold cart cleanup job failed:', e);
    }
  });

  // 3. FEFO Expiry Scan & Socket Broadcast: Daily at 07:00 AM
  cron.schedule('0 7 * * *', async () => {
    try {
      await scanFefoExpiryAlerts();
    } catch (e) {
      console.error('❌ [CRON] FEFO scan job failed:', e);
    }
  });

  console.log('⏰ Background Cron Schedulers initialized (Summary @ 00:05, Cart Cleanup hourly, FEFO Scan @ 07:00)');
};

export { runDailySummaryJob, cleanupExpiredHoldCarts, scanFefoExpiryAlerts };
