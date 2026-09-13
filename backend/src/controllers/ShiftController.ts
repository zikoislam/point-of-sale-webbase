import { Request, Response, NextFunction } from 'express';
import { shiftService } from '../services/ShiftService';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

class ShiftController {
  async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const shift = await shiftService.getActiveShift(userId);
      sendSuccess(res, 200, 'Active shift fetched', shift);
    } catch (err) { next(err); }
  }

  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const shift = await shiftService.openShift(userId, req.body);
      sendSuccess(res, 201, 'Shift opened successfully', shift);
    } catch (err) { next(err); }
  }

  async addPettyCash(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      let shiftId = req.params.id;
      if (!shiftId) {
        const active = await shiftService.getActiveShift(userId);
        if (!active) throw new AppError(404, 'SHIFT_NOT_FOUND', 'No active shift found');
        shiftId = active._id.toString();
      }
      const shift = await shiftService.addPettyCash(shiftId, req.body, userId);
      sendSuccess(res, 200, 'Petty cash updated', shift);
    } catch (err) { next(err); }
  }

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const shift = await shiftService.closeShift(req.params.id, req.body, userId);
      sendSuccess(res, 200, 'Shift closed successfully', shift);
    } catch (err) { next(err); }
  }

  async getZReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await shiftService.getZReport(req.params.id);
      sendSuccess(res, 200, 'Z-Report generated', report);
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;
      const result = await shiftService.listShifts(page, limit, status, userId);
      sendSuccess(res, 200, 'Shifts fetched', result);
    } catch (err) { next(err); }
  }
}

export const shiftController = new ShiftController();
