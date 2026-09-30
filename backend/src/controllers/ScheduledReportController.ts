import { Request, Response, NextFunction } from 'express';
import { scheduledReportService, ScheduledReportDto, REPORT_META } from '../services/ScheduledReportService';
import { REPORT_TYPES } from '../models/ScheduledReport';
import { sendSuccess } from '../utils/api-response';
import { isMailConfigured } from '../utils/mailer';

export class ScheduledReportController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await scheduledReportService.list();
      sendSuccess(res, 200, 'Scheduled reports retrieved', data);
    } catch (error) { next(error); }
  }

  /** The catalogue the UI shows when picking a report. */
  async options(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Scheduled report options retrieved', {
        emailConfigured: isMailConfigured(),
        reportTypes: REPORT_TYPES.map((type) => ({
          type,
          title: REPORT_META[type]?.title || type,
          dated: REPORT_META[type]?.dated !== false,
        })),
      });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Scheduled report retrieved', await scheduledReportService.getById(req.params.id));
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await scheduledReportService.create(req.body as ScheduledReportDto, req.user!.userId);
      sendSuccess(res, 201, 'Scheduled report created', report);
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Scheduled report updated', await scheduledReportService.update(req.params.id, req.body));
    } catch (error) { next(error); }
  }

  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Scheduled report updated', await scheduledReportService.toggle(req.params.id));
    } catch (error) { next(error); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Scheduled report deleted', await scheduledReportService.remove(req.params.id));
    } catch (error) { next(error); }
  }

  /** Runs it immediately (also handy to verify the setup). */
  async runNow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await scheduledReportService.run(req.params.id, { force: true });
      sendSuccess(
        res,
        200,
        result.status === 'SUCCESS'
          ? 'Report generated and emailed'
          : result.status === 'SKIPPED'
          ? `Report generated, email skipped: ${result.error}`
          : `Report run failed: ${result.error}`,
        result
      );
    } catch (error) { next(error); }
  }

  /** Cron tick, exposed so a host without a long-lived process can drive it. */
  async runDue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await scheduledReportService.runDueReports();
      sendSuccess(res, 200, `${result.ran} scheduled report(s) processed`, result);
    } catch (error) { next(error); }
  }
}

export const scheduledReportController = new ScheduledReportController();
