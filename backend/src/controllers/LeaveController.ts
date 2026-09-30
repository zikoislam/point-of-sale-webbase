import { Request, Response, NextFunction } from 'express';
import { leaveService, CreateLeaveDto } from '../services/LeaveService';
import { sendSuccess } from '../utils/api-response';

export class LeaveController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await leaveService.list({
        status: req.query.status as string,
        employeeId: req.query.employeeId as string,
        from: req.query.from as string,
        to: req.query.to as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      sendSuccess(res, 200, 'Leave requests retrieved', data);
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await leaveService.create(req.body as CreateLeaveDto, req.user!.userId);
      sendSuccess(res, 201, 'Leave request submitted', request);
    } catch (error) { next(error); }
  }

  /** Approving also writes LEAVE attendance rows for the covered days. */
  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leaveService.decide(req.params.id, 'APPROVED', req.user!.userId, req.body?.note);
      sendSuccess(res, 200, `Leave approved — ${result.attendanceMarkedDays} attendance day(s) marked`, result);
    } catch (error) { next(error); }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leaveService.decide(req.params.id, 'REJECTED', req.user!.userId, req.body?.note);
      sendSuccess(res, 200, 'Leave rejected', result);
    } catch (error) { next(error); }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await leaveService.cancel(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Leave request cancelled', request);
    } catch (error) { next(error); }
  }

  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await leaveService.getLeaveSummary({ from: req.query.from as string, to: req.query.to as string });
      sendSuccess(res, 200, 'Leave summary generated', data);
    } catch (error) { next(error); }
  }
}

export const leaveController = new LeaveController();
