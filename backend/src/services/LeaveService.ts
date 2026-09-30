import { Types } from 'mongoose';
import { LeaveRequest, LEAVE_TYPES } from '../models/LeaveRequest';
import { Employee } from '../models/Employee';
import { Attendance } from '../models/Attendance';
import { AppError } from '../utils/app-error';
import { notificationService } from './NotificationService';
import { nextSequence } from './SequenceService';

export interface CreateLeaveDto {
  employeeId: string;
  leaveType?: (typeof LEAVE_TYPES)[number];
  fromDate: string;
  toDate: string;
  reason?: string;
}

/** Inclusive day count between two YYYY-MM-DD dates. */
function countDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) throw new AppError(400, 'INVALID_DATE', 'Dates must be YYYY-MM-DD');
  if (end < start) throw new AppError(400, 'INVALID_RANGE', 'The end date cannot be before the start date');
  return Math.round((end - start) / 86400000) + 1;
}

/** Every date in the range, as YYYY-MM-DD strings. */
function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Leave management (Module 9).
 *
 * A leave request is approved or rejected by a manager; approving it also
 * writes LEAVE attendance rows for the covered days, so payroll/absenteeism
 * reporting sees the leave instead of treating it as absence.
 */
class LeaveService {
  private async generateRequestNo(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await nextSequence(`leave_seq_${year}`);
    return `LV-${year}-${String(seq).padStart(4, '0')}`;
  }

  async list(options: { status?: string; employeeId?: string; from?: string; to?: string; limit?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.employeeId && Types.ObjectId.isValid(options.employeeId)) {
      filter.employeeId = new Types.ObjectId(options.employeeId);
    }
    if (options.from) filter.toDate = { $gte: options.from };
    if (options.to) filter.fromDate = { ...(filter.fromDate || {}), $lte: options.to };

    const rows = await LeaveRequest.find(filter)
      .populate('employeeId', 'name employeeCode designation department')
      .populate('approvedById', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(Math.min(options.limit || 100, 300))
      .lean();

    const summary = {
      total: rows.length,
      pending: rows.filter((r: any) => r.status === 'PENDING').length,
      approved: rows.filter((r: any) => r.status === 'APPROVED').length,
      rejected: rows.filter((r: any) => r.status === 'REJECTED').length,
      approvedDays: rows
        .filter((r: any) => r.status === 'APPROVED')
        .reduce((s: number, r: any) => s + (r.days || 0), 0),
    };

    return { summary, data: rows };
  }

  async create(dto: CreateLeaveDto, userId: string) {
    if (!dto.employeeId || !Types.ObjectId.isValid(dto.employeeId)) {
      throw new AppError(400, 'INVALID_EMPLOYEE', 'A valid employee is required');
    }
    const employee: any = await Employee.findById(dto.employeeId).lean();
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

    const days = countDays(dto.fromDate, dto.toDate);

    // Overlapping requests for the same employee are usually a mistake
    const overlap = await LeaveRequest.findOne({
      employeeId: new Types.ObjectId(dto.employeeId),
      status: { $in: ['PENDING', 'APPROVED'] },
      fromDate: { $lte: dto.toDate },
      toDate: { $gte: dto.fromDate },
    }).lean();
    if (overlap) {
      throw new AppError(
        409,
        'OVERLAPPING_LEAVE',
        `${(overlap as any).requestNo} already covers ${(overlap as any).fromDate} → ${(overlap as any).toDate}`
      );
    }

    const requestNo = await this.generateRequestNo();
    const request = await LeaveRequest.create({
      requestNo,
      employeeId: new Types.ObjectId(dto.employeeId),
      leaveType: dto.leaveType || 'CASUAL',
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      days,
      reason: dto.reason,
      status: 'PENDING',
      createdBy: new Types.ObjectId(userId),
    });

    notificationService.notify({
      type: 'SYSTEM',
      title: `Leave request ${requestNo}`,
      message: `${employee.name} requested ${days} day(s) of ${dto.leaveType || 'CASUAL'} leave (${dto.fromDate} → ${dto.toDate})`,
      entityType: 'hr/leave',
      entityId: String(request._id),
    });

    return request.toObject();
  }

  /**
   * Approving marks the attendance as LEAVE for every day in the range —
   * without it, payroll would treat the days as absences.
   */
  async decide(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    userId: string,
    note?: string
  ) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid leave request ID');
    const request = await LeaveRequest.findById(id);
    if (!request) throw new AppError(404, 'LEAVE_NOT_FOUND', 'Leave request not found');
    if (request.status !== 'PENDING') {
      throw new AppError(409, 'NOT_PENDING', `This request is already ${request.status.toLowerCase()}`);
    }

    request.status = decision;
    request.approvedById = new Types.ObjectId(userId);
    request.decidedAt = new Date();
    request.decisionNote = note;

    let markedDays = 0;
    if (decision === 'APPROVED') {
      for (const date of eachDay(request.fromDate, request.toDate)) {
        const existing: any = await Attendance.findOne({ employeeId: request.employeeId, date });
        if (existing) {
          // Never overwrite a real check-in — a present day stays present
          if (existing.status === 'PRESENT' || existing.status === 'HALF_DAY') continue;
          existing.status = 'LEAVE';
          existing.notes = `Approved leave ${request.requestNo}`;
          existing.markedById = new Types.ObjectId(userId);
          await existing.save();
        } else {
          await Attendance.create({
            employeeId: request.employeeId,
            date,
            status: 'LEAVE',
            notes: `Approved leave ${request.requestNo}`,
            markedById: new Types.ObjectId(userId),
          });
        }
        markedDays += 1;
      }
      request.attendanceMarked = true;
    }

    await request.save();

    notificationService.notify({
      type: 'SYSTEM',
      title: `Leave ${decision === 'APPROVED' ? 'approved' : 'rejected'}`,
      message: `${request.requestNo} (${request.days} day(s)) was ${decision.toLowerCase()}${note ? ` — ${note}` : ''}`,
      entityType: 'hr/leave',
      entityId: String(request._id),
    });

    return { request: request.toObject(), attendanceMarkedDays: markedDays };
  }

  async cancel(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid leave request ID');
    const request = await LeaveRequest.findById(id);
    if (!request) throw new AppError(404, 'LEAVE_NOT_FOUND', 'Leave request not found');
    if (request.status === 'APPROVED' && request.attendanceMarked) {
      throw new AppError(
        409,
        'LEAVE_APPROVED',
        'This leave is already approved and marked in attendance — cancel it from the attendance screen instead'
      );
    }
    if (request.status !== 'PENDING') throw new AppError(409, 'NOT_PENDING', `This request is already ${request.status.toLowerCase()}`);

    request.status = 'CANCELLED';
    request.approvedById = new Types.ObjectId(userId);
    request.decidedAt = new Date();
    await request.save();
    return request.toObject();
  }

  /** Leave days per employee for a period — the absenteeism report ingredient. */
  async getLeaveSummary(options: { from?: string; to?: string } = {}) {
    const filter: Record<string, any> = { status: 'APPROVED' };
    if (options.from) filter.toDate = { $gte: options.from };
    if (options.to) filter.fromDate = { ...(filter.fromDate || {}), $lte: options.to };

    const rows = await LeaveRequest.find(filter)
      .populate('employeeId', 'name employeeCode designation department')
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const byEmployee = new Map<string, any>();
    for (const r of rows as any[]) {
      const key = String(r.employeeId?._id || r.employeeId);
      const bucket = byEmployee.get(key) || {
        employeeId: key,
        employeeName: r.employeeId?.name || 'Unknown',
        employeeCode: r.employeeId?.employeeCode || '',
        department: r.employeeId?.department || '',
        days: 0,
        requests: 0,
        byType: {} as Record<string, number>,
      };
      bucket.days += r.days || 0;
      bucket.requests += 1;
      bucket.byType[r.leaveType] = round((bucket.byType[r.leaveType] || 0) + (r.days || 0));
      byEmployee.set(key, bucket);
    }

    const data = Array.from(byEmployee.values()).sort((a, b) => b.days - a.days);
    const byType: Record<string, number> = {};
    for (const r of rows as any[]) byType[r.leaveType] = round((byType[r.leaveType] || 0) + (r.days || 0));

    return {
      summary: {
        requests: rows.length,
        employees: data.length,
        totalDays: round(data.reduce((s, d) => s + d.days, 0)),
        averageDaysPerEmployee: data.length ? round(data.reduce((s, d) => s + d.days, 0) / data.length) : 0,
        byType,
      },
      data,
    };
  }
}

export const leaveService = new LeaveService();
