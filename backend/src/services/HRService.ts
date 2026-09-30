import { Types } from 'mongoose';
import { Employee, IEmployee } from '../models/Employee';
import { Attendance } from '../models/Attendance';
import { EmployeeAdvance, IEmployeeAdvance } from '../models/EmployeeAdvance';
import { PayrollRun, IPayrollRun, IPayrollLine } from '../models/PayrollRun';
import { Account } from '../models/Account';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { accountingService, JournalLineInput } from './AccountingService';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  MarkAttendanceInput,
  CreateAdvanceInput,
} from '../validators/hr.validators';

const daysInMonth = (period: string): number => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export class HRService {
  // ── employees ────────────────────────────────────────────────────────────
  async listEmployees(activeOnly?: boolean): Promise<IEmployee[]> {
    const filter: Record<string, any> = {};
    if (activeOnly) filter.isActive = true;
    return Employee.find(filter).sort({ employeeCode: 1 }).lean() as unknown as Promise<IEmployee[]>;
  }

  async createEmployee(data: CreateEmployeeInput): Promise<IEmployee> {
    const clash = await Employee.findOne({ employeeCode: data.employeeCode.toUpperCase() }).lean();
    if (clash) throw new AppError(409, 'EMPLOYEE_EXISTS', `Employee code "${data.employeeCode}" already exists`);
    const employee = await Employee.create({
      employeeCode: data.employeeCode.toUpperCase(),
      name: data.name,
      phone: data.phone,
      designation: data.designation,
      department: data.department,
      joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
      salary: {
        basic: data.salaryBasic || 0,
        allowances: data.allowances || [],
        deductions: data.deductions || [],
      },
      bankOrMfsAccount: data.bankOrMfsAccount,
      address: data.address,
      isActive: data.isActive ?? true,
    });
    return employee.toObject() as unknown as IEmployee;
  }

  async updateEmployee(id: string, data: UpdateEmployeeInput): Promise<IEmployee> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid employee ID');
    const employee = await Employee.findById(id);
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

    if (data.employeeCode !== undefined) employee.employeeCode = data.employeeCode.toUpperCase();
    if (data.name !== undefined) employee.name = data.name;
    if (data.phone !== undefined) employee.phone = data.phone;
    if (data.designation !== undefined) employee.designation = data.designation;
    if (data.department !== undefined) employee.department = data.department;
    if (data.joinDate !== undefined) employee.joinDate = new Date(data.joinDate);
    if (data.salaryBasic !== undefined) employee.salary.basic = data.salaryBasic;
    if (data.allowances !== undefined) employee.salary.allowances = data.allowances;
    if (data.deductions !== undefined) employee.salary.deductions = data.deductions;
    if (data.bankOrMfsAccount !== undefined) employee.bankOrMfsAccount = data.bankOrMfsAccount;
    if (data.address !== undefined) employee.address = data.address;
    if (data.isActive !== undefined) employee.isActive = data.isActive;

    await employee.save();
    return employee.toObject() as unknown as IEmployee;
  }

  // ── attendance ───────────────────────────────────────────────────────────
  async listAttendance(date: string): Promise<Array<any>> {
    const employees = await Employee.find({ isActive: true }).sort({ employeeCode: 1 }).lean();
    const records = await Attendance.find({ date }).lean();
    const byEmployee = new Map(records.map((r: any) => [String(r.employeeId), r]));
    return employees.map((e: any) => ({
      employee: { id: String(e._id), code: e.employeeCode, name: e.name, designation: e.designation },
      attendance: byEmployee.get(String(e._id)) || null,
    }));
  }

  /** Bulk upsert of one day's attendance. */
  async markAttendance(data: MarkAttendanceInput, actorId: string): Promise<{ saved: number }> {
    let saved = 0;
    for (const entry of data.entries) {
      if (!Types.ObjectId.isValid(entry.employeeId)) {
        throw new AppError(400, 'INVALID_ID', `Invalid employee ID: ${entry.employeeId}`);
      }
      await Attendance.updateOne(
        { employeeId: new Types.ObjectId(entry.employeeId), date: data.date },
        {
          $set: {
            status: entry.status,
            checkIn: entry.checkIn ? new Date(entry.checkIn) : undefined,
            checkOut: entry.checkOut ? new Date(entry.checkOut) : undefined,
            notes: entry.notes,
            markedById: new Types.ObjectId(actorId),
          },
        },
        { upsert: true }
      );
      saved += 1;
    }
    return { saved };
  }

  // ── advances ─────────────────────────────────────────────────────────────
  async listAdvances(): Promise<Array<any>> {
    const advances = await EmployeeAdvance.find()
      .populate('employeeId', 'name employeeCode')
      .sort({ date: -1 })
      .limit(200)
      .lean();
    return advances.map((a: any) => ({
      ...a,
      remainingDue: roundMoney(a.amount - (a.recoveries || []).reduce((n: number, r: any) => n + r.amount, 0)),
    }));
  }

  async createAdvance(data: CreateAdvanceInput, actorId: string): Promise<IEmployeeAdvance> {
    if (!Types.ObjectId.isValid(data.employeeId)) throw new AppError(400, 'INVALID_ID', 'Invalid employee ID');
    const advance = await EmployeeAdvance.create({
      employeeId: new Types.ObjectId(data.employeeId),
      amount: data.amount,
      reason: data.reason,
      accountId: data.accountId && Types.ObjectId.isValid(data.accountId) ? new Types.ObjectId(data.accountId) : null,
      createdById: new Types.ObjectId(actorId),
    });
    return advance.toObject() as unknown as IEmployeeAdvance;
  }

  // ── payroll ──────────────────────────────────────────────────────────────
  async listPayrollRuns(): Promise<Array<any>> {
    return PayrollRun.find().sort({ period: -1 }).limit(60).lean();
  }

  async getPayrollRun(id: string): Promise<IPayrollRun> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid payroll ID');
    const run = await PayrollRun.findById(id).lean();
    if (!run) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'Payroll run not found');
    return run as unknown as IPayrollRun;
  }

  /** Builds the draft payroll for a month from salary structures + attendance. */
  async generatePayroll(period: string, actorId: string): Promise<IPayrollRun> {
    const existing = await PayrollRun.findOne({ period }).lean();
    if (existing) throw new AppError(409, 'PAYROLL_EXISTS', `Payroll for ${period} already exists`);

    const employees = await Employee.find({ isActive: true }).lean();
    if (employees.length === 0) throw new AppError(400, 'NO_EMPLOYEES', 'Add employees before running payroll');

    const totalDays = daysInMonth(period);
    const monthStart = `${period}-01`;

    const lines: IPayrollLine[] = [];
    let totalNet = 0;

    for (const emp of employees as any[]) {
      const records = await Attendance.find({
        employeeId: emp._id,
        date: { $gte: monthStart, $lte: `${period}-31` },
      }).lean();

      const presentDays = records.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const halfDays = records.filter((r: any) => r.status === 'HALF_DAY').length;
      // Attendance factor: half days count half. Without any records the full
      // salary is paid (e.g. payroll set up before attendance tracking starts).
      const paidDays = records.length === 0 ? totalDays : presentDays + halfDays * 0.5;
      const factor = totalDays > 0 ? paidDays / totalDays : 1;

      const allowancesTotal = (emp.salary.allowances || []).reduce((n: number, a: any) => n + a.amount, 0);
      const deductionsTotal = (emp.salary.deductions || []).reduce((n: number, d: any) => n + d.amount, 0);

      // Recover up to one open advance as far as this month's net allows
      const advances = await EmployeeAdvance.find({ employeeId: emp._id }).lean();
      const openAdvances = advances
        .map((a: any) => ({
          doc: a,
          due: roundMoney(a.amount - (a.recoveries || []).reduce((n: number, r: any) => n + r.amount, 0)),
        }))
        .filter((a) => a.due > 0.005);

      const basic = roundMoney(emp.salary.basic * factor);
      const allowances = roundMoney(allowancesTotal * factor);
      const beforeAdvance = roundMoney(basic + allowances - deductionsTotal);

      let advanceDeducted = 0;
      for (const adv of openAdvances) {
        if (advanceDeducted >= beforeAdvance - 0.005) break;
        const take = Math.min(adv.due, roundMoney(beforeAdvance - advanceDeducted));
        advanceDeducted = roundMoney(advanceDeducted + take);
      }

      const netPay = roundMoney(Math.max(0, beforeAdvance - advanceDeducted));

      lines.push({
        employeeId: emp._id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode,
        presentDays: paidDays,
        halfDays,
        basic,
        allowances,
        overtime: 0,
        bonus: 0,
        advanceDeducted,
        deductions: deductionsTotal,
        netPay,
      });
      totalNet = roundMoney(totalNet + netPay);
    }

    const run = await PayrollRun.create({
      period,
      lines,
      totalNet,
      status: 'DRAFT',
      createdById: new Types.ObjectId(actorId),
    });
    return run.toObject() as unknown as IPayrollRun;
  }

  async setPayrollStatus(id: string, status: 'APPROVED' | 'CANCELLED'): Promise<IPayrollRun> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid payroll ID');
    const run = await PayrollRun.findById(id);
    if (!run) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'Payroll run not found');
    if (run.status !== 'DRAFT') throw new AppError(409, 'PAYROLL_NOT_DRAFT', `Only draft payroll can be ${status.toLowerCase()}`);
    run.status = status;
    await run.save();
    return run.toObject() as unknown as IPayrollRun;
  }

  /**
   * Pays an approved payroll out of a wallet and posts the salary journal
   * (Dr Salary Expense, Cr wallet). Also records advance recoveries.
   */
  async payPayroll(id: string, accountId: string, actorId: string): Promise<IPayrollRun> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(accountId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid payroll or account ID');
    }
    const run = await PayrollRun.findById(id);
    if (!run) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'Payroll run not found');
    if (run.status !== 'APPROVED') throw new AppError(409, 'PAYROLL_NOT_APPROVED', 'Only approved payroll can be paid');

    const wallet = await Account.findById(accountId).lean();
    if (!wallet) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Payment account not found');

    // Salary expense head (created on first payroll, 51xx operating range)
    let salaryHead: any = await Account.findOne({ type: 'EXPENSE', name: 'Salary & Allowances' }).lean();
    if (!salaryHead) {
      const used = new Set(
        (await Account.find({ code: { $regex: '^51\\d\\d$' } }).lean()).map((a: any) => Number(a.code))
      );
      let code = 5100;
      while (used.has(code)) code += 1;
      const created = await Account.create({
        orgId: run.orgId,
        code: String(code),
        name: 'Salary & Allowances',
        type: 'EXPENSE',
        subType: 'OPERATING',
        accountType: 'OTHER',
        normalBalance: 'DEBIT',
        isSystem: true,
        isCashEquivalent: false,
        currentBalance: 0,
      });
      salaryHead = created.toObject();
    }

    const lines: JournalLineInput[] = [
      { accountId: String(salaryHead._id), debit: run.totalNet, credit: 0, memo: `Salary ${run.period}` },
      { accountId, debit: 0, credit: run.totalNet, memo: `Salary paid · ${wallet.name}` },
    ];

    const entry = await accountingService.postJournal({
      date: new Date(),
      narration: `Payroll ${run.period}`,
      source: 'PAYROLL',
      referenceType: 'PAYROLL',
      referenceId: run._id,
      createdById: actorId,
      lines,
    });

    // Record advance recoveries taken in this run
    for (const lineItem of run.lines) {
      if (lineItem.advanceDeducted > 0.005) {
        const advances = await EmployeeAdvance.find({ employeeId: lineItem.employeeId }).lean();
        let remaining = lineItem.advanceDeducted;
        for (const adv of advances as any[]) {
          if (remaining <= 0.005) break;
          const due = roundMoney(adv.amount - (adv.recoveries || []).reduce((n: number, r: any) => n + r.amount, 0));
          if (due <= 0.005) continue;
          const take = Math.min(due, remaining);
          await EmployeeAdvance.updateOne(
            { _id: adv._id },
            { $push: { recoveries: { amount: take, date: new Date() } } }
          );
          remaining = roundMoney(remaining - take);
        }
      }
    }

    run.status = 'PAID';
    run.paidById = new Types.ObjectId(actorId);
    run.paidAt = new Date();
    run.accountId = new Types.ObjectId(accountId);
    run.journalEntryId = entry ? new Types.ObjectId((entry as any)._id) : null;
    await run.save();
    return run.toObject() as unknown as IPayrollRun;
  }
}

export const hrService = new HRService();
