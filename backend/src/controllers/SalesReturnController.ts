import { Request, Response, NextFunction } from 'express';
import { salesReturnService } from '../services/SalesReturnService';
import { sendSuccess } from '../utils/api-response';

class SalesReturnController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await salesReturnService.list(page, limit);
      sendSuccess(res, 200, 'Sales returns fetched', result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const ret = await salesReturnService.getById(req.params.id);
      sendSuccess(res, 200, 'Sales return details fetched', ret);
    } catch (err) { next(err); }
  }

  async processReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const ret = await salesReturnService.processReturn(req.body, userId);
      sendSuccess(res, 201, 'Return processed successfully', ret);
    } catch (err) { next(err); }
  }

  async validateVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const voucher = await salesReturnService.validateVoucher(req.params.code);
      sendSuccess(res, 200, 'Voucher valid', voucher);
    } catch (err) { next(err); }
  }
}

export const salesReturnController = new SalesReturnController();
