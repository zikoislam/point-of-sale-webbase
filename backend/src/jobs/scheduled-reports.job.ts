import cron from 'node-cron';
import { scheduledReportService } from '../services/ScheduledReportService';

/**
 * Scheduled auto-reports (Phase 11).
 *
 * Ticks every minute and runs whatever is due — each report is rendered inside
 * its own organization scope so the tenant isolation stays intact even though
 * the job runs outside any request.
 */
export const runScheduledReportsTick = async (): Promise<any> => {
  try {
    return await scheduledReportService.runDueReports();
  } catch (e) {
    console.error('❌ [CRON] Scheduled reports tick failed:', e);
    return { ran: 0, results: [] };
  }
};

export const initScheduledReportJob = (): void => {
  // Every minute — the per-report timeOfDay decides whether it actually fires
  cron.schedule('* * * * *', async () => {
    const result = await runScheduledReportsTick();
    if (result.ran > 0) {
      const ok = result.results.filter((r: any) => r.status === 'SUCCESS').length;
      console.log(`📧 Scheduled reports: ${result.ran} due, ${ok} emailed`);
    }
  });
};
