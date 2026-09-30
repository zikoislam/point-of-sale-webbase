import { Types } from 'mongoose';
import { ScheduledReport, IScheduledReport, ReportType, Frequency, REPORT_TYPES } from '../models/ScheduledReport';
import { Organization } from '../models/Organization';
import { exportService } from './ExportService';
import { reportService } from './ReportService';
import { sendMail, isMailConfigured } from '../utils/mailer';
import { AppError } from '../utils/app-error';
import { runWithOrg } from '../middlewares/org.context';
import { notificationService } from './NotificationService';

export interface ScheduledReportDto {
  name: string;
  reportType: ReportType;
  frequency: Frequency;
  timeOfDay: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  periodDays?: number;
  recipients: string[];
  format?: 'PDF' | 'EXCEL';
  extraParams?: Record<string, string>;
  isActive?: boolean;
}

/** Human title + the parameters each report needs for a scheduled render. */
const REPORT_META: Record<string, { title: string; dated: boolean }> = {
  sales: { title: 'Sales Summary', dated: true },
  'daily-register': { title: 'Daily Sales Register', dated: true },
  'top-products': { title: 'Top Selling Products', dated: true },
  'wholesale-vs-retail': { title: 'Wholesale vs Retail', dated: true },
  'category-wise-sales': { title: 'Category-wise Sales', dated: true },
  inventory: { title: 'Inventory Valuation', dated: false },
  'inventory-valuation': { title: 'Inventory Valuation', dated: false },
  'low-stock': { title: 'Low Stock', dated: false },
  'dead-stock': { title: 'Dead Stock', dated: false },
  'stock-reorder': { title: 'Stock Reorder Points', dated: false },
  'auto-reorder': { title: 'Auto Reorder Suggestions', dated: false },
  expiry: { title: 'Batch Expiry', dated: false },
  'stock-movement-summary': { title: 'Stock Movement Summary', dated: true },
  'inventory-aging': { title: 'Inventory Aging', dated: false },
  purchases: { title: 'Purchases', dated: true },
  'supplier-price-comparison': { title: 'Supplier Price Comparison', dated: false },
  'purchase-vs-sales': { title: 'Purchase vs Sales Turnover', dated: true },
  pnl: { title: 'Profit & Loss', dated: true },
  dues: { title: 'Customer Dues', dated: false },
  payables: { title: 'Supplier Payables', dated: false },
  'agent-payables': { title: 'C&F Agent Payables', dated: false },
  'lc-status': { title: 'LC Status', dated: false },
  'landed-cost': { title: 'Landed Cost Analysis', dated: false },
  'pending-approvals': { title: 'Pending Approvals', dated: false },
  'project-pnl': { title: 'Project-wise P&L', dated: false },
  wastage: { title: 'Wastage', dated: true },
  'online-vs-offline': { title: 'Online vs Offline Sales', dated: true },
  'fulfillment-rate': { title: 'eCommerce Fulfilment Rate', dated: true },
  'lead-conversion': { title: 'Lead Conversion', dated: true },
  'ticket-sla': { title: 'Support Ticket SLA', dated: true },
  'leave-summary': { title: 'Leave Summary', dated: true },
};

class ScheduledReportService {
  /* ───────────────────────────── CRUD ───────────────────────────── */

  /** Next fire time, in server-local time, for the given rule. */
  computeNextRun(
    report: Pick<IScheduledReport, 'frequency' | 'timeOfDay' | 'dayOfWeek' | 'dayOfMonth'>,
    from: Date = new Date()
  ): Date {
    const [hh, mm] = report.timeOfDay.split(':').map((n) => parseInt(n, 10));
    const next = new Date(from);
    next.setSeconds(0, 0);

    if (report.frequency === 'DAILY') {
      next.setHours(hh, mm, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }

    if (report.frequency === 'WEEKLY') {
      const target = report.dayOfWeek ?? 0;
      next.setHours(hh, mm, 0, 0);
      const delta = (target - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + delta);
      if (next <= from) next.setDate(next.getDate() + 7);
      return next;
    }

    // MONTHLY (day 1–28 keeps every month valid)
    const day = report.dayOfMonth ?? 1;
    next.setHours(hh, mm, 0, 0);
    next.setDate(day);
    if (next <= from) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(day);
    }
    return next;
  }

  async list() {
    const reports = await ScheduledReport.find({}).populate('createdBy', 'fullName username').sort({ createdAt: -1 }).lean();
    return reports;
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid scheduled report ID');
    const report = await ScheduledReport.findById(id).lean();
    if (!report) throw new AppError(404, 'SCHEDULED_REPORT_NOT_FOUND', 'Scheduled report not found');
    return report;
  }

  /** Which reports are due right now (used by the cron tick). */
  async dueReports(now: Date = new Date()) {
    return ScheduledReport.find({
      isActive: true,
      $or: [{ nextRunAt: { $lte: now } }, { nextRunAt: null }],
    })
      .select('_id name orgId')
      .lean();
  }

  private validate(dto: Partial<ScheduledReportDto>) {
    if (dto.reportType && !REPORT_TYPES.includes(dto.reportType)) {
      throw new AppError(400, 'UNKNOWN_REPORT_TYPE', `Unknown report type ${dto.reportType}`);
    }
    if (dto.timeOfDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dto.timeOfDay)) {
      throw new AppError(400, 'INVALID_TIME', 'Time must look like 08:30');
    }
    if (dto.recipients && dto.recipients.filter((r) => /.+@.+\..+/.test(r)).length === 0) {
      throw new AppError(400, 'INVALID_RECIPIENTS', 'At least one valid email address is required');
    }
    if (dto.frequency === 'WEEKLY' && dto.dayOfWeek === undefined) {
      throw new AppError(400, 'DAY_REQUIRED', 'A weekly report needs a day of the week');
    }
    if (dto.frequency === 'MONTHLY' && dto.dayOfMonth === undefined) {
      throw new AppError(400, 'DAY_REQUIRED', 'A monthly report needs a day of the month');
    }
  }

  async create(dto: ScheduledReportDto, userId: string) {
    this.validate(dto);
    const nextRunAt = this.computeNextRun({
      frequency: dto.frequency,
      timeOfDay: dto.timeOfDay,
      dayOfWeek: dto.dayOfWeek ?? null,
      dayOfMonth: dto.dayOfMonth ?? null,
    } as any);

    const report = await ScheduledReport.create({
      name: dto.name.trim(),
      reportType: dto.reportType,
      frequency: dto.frequency,
      timeOfDay: dto.timeOfDay,
      dayOfWeek: dto.frequency === 'WEEKLY' ? dto.dayOfWeek ?? 0 : null,
      dayOfMonth: dto.frequency === 'MONTHLY' ? dto.dayOfMonth ?? 1 : null,
      periodDays: dto.periodDays || (dto.frequency === 'DAILY' ? 1 : dto.frequency === 'WEEKLY' ? 7 : 30),
      recipients: dto.recipients.map((r) => r.trim()).filter(Boolean),
      format: dto.format || 'PDF',
      extraParams: dto.extraParams || {},
      isActive: dto.isActive !== false,
      nextRunAt,
      createdBy: new Types.ObjectId(userId),
    });

    return report.toObject() as unknown as IScheduledReport;
  }

  async update(id: string, dto: Partial<ScheduledReportDto>) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid scheduled report ID');
    this.validate(dto);
    const report = await ScheduledReport.findById(id);
    if (!report) throw new AppError(404, 'SCHEDULED_REPORT_NOT_FOUND', 'Scheduled report not found');

    if (dto.name !== undefined) report.name = dto.name.trim();
    if (dto.reportType !== undefined) report.reportType = dto.reportType;
    if (dto.frequency !== undefined) report.frequency = dto.frequency;
    if (dto.timeOfDay !== undefined) report.timeOfDay = dto.timeOfDay;
    if (dto.dayOfWeek !== undefined) report.dayOfWeek = dto.dayOfWeek;
    if (dto.dayOfMonth !== undefined) report.dayOfMonth = dto.dayOfMonth;
    if (dto.periodDays !== undefined) report.periodDays = dto.periodDays;
    if (dto.recipients !== undefined) report.recipients = dto.recipients.map((r) => r.trim()).filter(Boolean);
    if (dto.format !== undefined) report.format = dto.format;
    if (dto.extraParams !== undefined) report.extraParams = dto.extraParams;
    if (dto.isActive !== undefined) report.isActive = !!dto.isActive;

    // A rule change re-plans the next run
    report.nextRunAt = this.computeNextRun(report);
    await report.save();
    return report.toObject();
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid scheduled report ID');
    await ScheduledReport.deleteOne({ _id: id });
    return { ok: true };
  }

  /** Pause / resume without touching the rule. */
  async toggle(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid scheduled report ID');
    const report = await ScheduledReport.findById(id);
    if (!report) throw new AppError(404, 'SCHEDULED_REPORT_NOT_FOUND', 'Scheduled report not found');
    report.isActive = !report.isActive;
    if (report.isActive) report.nextRunAt = this.computeNextRun(report);
    await report.save();
    return report.toObject();
  }

  /* ───────────────────────────── running ───────────────────────────── */

  /** Builds the attachment for a report (PDF or Excel) over its period. */
  private async buildAttachment(report: IScheduledReport) {
    const end = new Date();
    const start = new Date(end.getTime() - (report.periodDays || 1) * 86400000);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const extra = { ...(report.extraParams || {}), startDate, endDate };
    const dated = REPORT_META[report.reportType]?.dated !== false;

    const buffer =
      report.format === 'EXCEL'
        ? await exportService.generateExcel(report.reportType, startDate, endDate, extra)
        : await exportService.generatePdf(report.reportType, startDate, endDate, extra);

    const extension = report.format === 'EXCEL' ? 'xlsx' : 'pdf';
    const safeName = `${report.reportType}-${startDate}-to-${endDate}.${extension}`;
    return { buffer, filename: safeName, startDate, endDate, dated };
  }

  /** A compact inline summary so the email is useful even without opening the file. */
  private async buildSummaryHtml(reportType: string, startDate: string, endDate: string): Promise<string> {
    const lines: string[] = [];
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px;color:#475569">${label}</td><td style="padding:6px 12px;text-align:right;font-weight:600;color:#0f172a">${value}</td></tr>`;

    try {
      const data: any = await reportService.getDashboardMetrics();
      if (data) {
        lines.push(row('Revenue (today)', `৳${Number(data.today?.revenue || 0).toFixed(2)}`));
        lines.push(row('Invoices (today)', String(data.today?.orders ?? 0)));
        lines.push(row('Revenue (this month)', `৳${Number(data.month?.revenue || 0).toFixed(2)}`));
        lines.push(row('Customer dues', `৳${Number(data.kpis?.customerDues || 0).toFixed(2)}`));
        lines.push(row('Low stock items', String(data.kpis?.lowStockItems ?? 0)));
        lines.push(row('Inventory value', `৳${Number(data.kpis?.inventoryValuation || 0).toFixed(2)}`));
      }
    } catch {
      // A KPI block is nice-to-have — never fail the report for it
    }

    const title = REPORT_META[reportType]?.title || reportType;
    return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:#0f172a;padding:16px 24px;color:#fff;font-size:16px;font-weight:700">${title}</div>
    <div style="padding:20px 12px">
      <p style="margin:0 12px 12px;color:#334155">Period: <strong>${startDate}</strong> to <strong>${endDate}</strong></p>
      ${lines.length ? `<table style="width:100%;border-collapse:collapse">${lines.join('')}</table>` : ''}
      <p style="margin:16px 12px 0;font-size:12px;color:#64748b">
        The full ${reportType} report is attached to this email.
      </p>
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
      Sent automatically by BDBBC ERP — scheduled reports.
    </div>
  </div>
</body></html>`;
  }

  /**
   * Runs one scheduled report: renders the attachment, emails it and records
   * the outcome. An unconfigured mail server is reported as SKIPPED, not a
   * silent failure, so the owner knows why nothing arrived.
   */
  async run(id: string, options: { force?: boolean } = {}) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid scheduled report ID');
    const report = await ScheduledReport.findById(id);
    if (!report) throw new AppError(404, 'SCHEDULED_REPORT_NOT_FOUND', 'Scheduled report not found');

    const startedAt = Date.now();
    let status: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SUCCESS';
    let error: string | null = null;
    let attachmentName = '';

    try {
      const attachment = await this.buildAttachment(report);
      attachmentName = attachment.filename;

      if (!isMailConfigured()) {
        status = 'SKIPPED';
        error = 'Email is not configured on this server (no SMTP / email API key)';
      } else {
        const html = await this.buildSummaryHtml(report.reportType, attachment.startDate, attachment.endDate);
        const text = `${report.name}\nPeriod: ${attachment.startDate} to ${attachment.endDate}\nAttached: ${attachment.filename}`;
        for (const to of report.recipients) {
          await sendMail({
            to,
            subject: `[${report.name}] ${attachment.startDate} → ${attachment.endDate}`,
            text,
            html,
            attachments: [{ filename: attachment.filename, content: attachment.buffer }],
          });
        }
      }
    } catch (err) {
      status = 'FAILED';
      error = (err as Error).message;
    }

    const durationMs = Date.now() - startedAt;
    report.lastRunAt = new Date();
    report.lastRunStatus = status;
    report.lastRunError = error;
    report.runCount = (report.runCount || 0) + 1;
    report.history.unshift({
      at: new Date(),
      status,
      recipients: report.recipients,
      attachment: attachmentName || undefined,
      error: error || undefined,
      durationMs,
    });
    if (report.history.length > 20) report.history.splice(20);
    report.nextRunAt = this.computeNextRun(report, new Date(Date.now() + 60_000));
    await report.save();

    if (status !== 'SUCCESS') {
      console.warn(`⚠️ scheduled report "${report.name}" (${report.reportType}) → ${status}: ${error}`);
    }

    return {
      id: String(report._id),
      name: report.name,
      status,
      error,
      attachment: attachmentName,
      recipients: report.recipients,
      durationMs,
      nextRunAt: report.nextRunAt,
    };
  }

  /**
   * Cron entry point: runs every due report inside its own organization scope
   * (the job runs outside any request, so the tenant context has to be opened
   * explicitly or the models would be scoped to the wrong org).
   */
  async runDueReports(now: Date = new Date()) {
    const due = await ScheduledReport.find({
      isActive: true,
      $or: [{ nextRunAt: { $lte: now } }, { nextRunAt: null }],
    })
      .select('_id orgId name')
      .lean();

    const results: Array<{ id: string; name: string; status: string; error?: string | null }> = [];
    for (const item of due) {
      const orgId = String(item.orgId);
      try {
        const outcome = await runWithOrg({ orgId }, () => this.run(String(item._id), { force: true }));
        results.push({ id: outcome.id, name: outcome.name, status: outcome.status, error: outcome.error });
        if (outcome.status === 'SUCCESS') {
          runWithOrg({ orgId }, () => {
            notificationService.notify({
              type: 'SYSTEM',
              title: 'Scheduled report sent',
              message: `${outcome.name} was emailed to ${outcome.recipients.join(', ')}`,
              entityType: 'scheduled-reports',
              entityId: outcome.id,
            });
          });
        }
      } catch (err) {
        results.push({ id: String(item._id), name: item.name, status: 'FAILED', error: (err as Error).message });
      }
    }

    return { ran: results.length, results };
  }
}

export const scheduledReportService = new ScheduledReportService();
export { REPORT_META };
