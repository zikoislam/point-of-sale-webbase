import { Request, Response, NextFunction } from 'express';
import { wastageService } from '../services/WastageService';
import { sendSuccess } from '../utils/api-response';

class WastageController {
  async record(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const movement = await wastageService.recordWastage(req.body, userId);
      sendSuccess(res, 201, 'Wastage recorded & stock adjusted', movement);
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await wastageService.listWastages(page, limit);
      sendSuccess(res, 200, 'Wastage records fetched', result);
    } catch (err) { next(err); }
  }
}

export const wastageController = new WastageController();
