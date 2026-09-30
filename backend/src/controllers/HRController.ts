import { Request, Response, NextFunction } from 'express';
import { hrService } from '../services/HRService';
import { sendSuccess } from '../utils/api-response';

export class HRController {
  async listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employees = await hrService.listEmployees(req.query.active === 'true');
      sendSuccess(res, 200, 'Employees retrieved successfully', employees);
    } catch (error) { next(error); }
  }

  async createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employee = await hrService.createEmployee(req.body);
      sendSuccess(res, 201, 'Employee created successfully', employee);
    } catch (error) { next(error); }
  }

  async updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employee = await hrService.updateEmployee(req.params.id, req.body);
      sendSuccess(res, 200, 'Employee updated successfully', employee);
    } catch (error) { next(error); }
  }

  async listAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await hrService.listAttendance((req.query.date as string) || new Date().toISOString().slice(0, 10));
      sendSuccess(res, 200, 'Attendance retrieved successfully', rows);
    } catch (error) { next(error); }
  }

  async markAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await hrService.markAttendance(req.body, req.user!.userId);
      sendSuccess(res, 200, `Attendance saved for ${result.saved} employee(s)`, result);
    } catch (error) { next(error); }
  }

  async listAdvances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const advances = await hrService.listAdvances();
      sendSuccess(res, 200, 'Advances retrieved successfully', advances);
    } catch (error) { next(error); }
  }

  async createAdvance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const advance = await hrService.createAdvance(req.body, req.user!.userId);
      sendSuccess(res, 201, 'Advance recorded successfully', advance);
    } catch (error) { next(error); }
  }

  async listPayrollRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const runs = await hrService.listPayrollRuns();
      sendSuccess(res, 200, 'Payroll runs retrieved successfully', runs);
    } catch (error) { next(error); }
  }

  async getPayrollRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await hrService.getPayrollRun(req.params.id);
      sendSuccess(res, 200, 'Payroll run retrieved successfully', run);
    } catch (error) { next(error); }
  }

  async generatePayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await hrService.generatePayroll(req.body.period, req.user!.userId);
      sendSuccess(res, 201, 'Payroll draft generated successfully', run);
    } catch (error) { next(error); }
  }

  async approvePayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await hrService.setPayrollStatus(req.params.id, 'APPROVED');
      sendSuccess(res, 200, 'Payroll approved', run);
    } catch (error) { next(error); }
  }

  async cancelPayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await hrService.setPayrollStatus(req.params.id, 'CANCELLED');
      sendSuccess(res, 200, 'Payroll cancelled', run);
    } catch (error) { next(error); }
  }

  async payPayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await hrService.payPayroll(req.params.id, req.body.accountId, req.user!.userId);
      sendSuccess(res, 200, 'Payroll paid and posted to the books', run);
    } catch (error) { next(error); }
  }
}

export const hrController = new HRController();
