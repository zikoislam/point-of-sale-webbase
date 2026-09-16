import { Request, Response, NextFunction } from 'express';
import { stockAdjustmentService } from '../services/StockAdjustmentService';
import { sendSuccess } from '../utils/api-response';

class StockAdjustmentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const result = await stockAdjustmentService.listAdjustments(page, limit, status);
      sendSuccess(res, 200, 'Stock adjustments fetched', result);
    } catch (err) { next(err); }
  }

  async request(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const userRole = (req as any).user.role?.name || (req as any).user.role;
      const adjustment = await stockAdjustmentService.requestAdjustment(req.body, userId, userRole);
      sendSuccess(res, 201, 'Stock adjustment requested successfully', adjustment);
    } catch (err) { next(err); }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { isApproved, rejectionReason } = req.body;
      const adminUserId = req.user?._id?.toString() || (req as any).user._id.toString();
      const adjustment = await stockAdjustmentService.approveAdjustment(req.params.id, adminUserId, isApproved, rejectionReason);
      sendSuccess(res, 200, `Stock adjustment ${isApproved ? 'approved' : 'rejected'} successfully`, adjustment);
    } catch (err) { next(err); }
  }
}

export const stockAdjustmentController = new StockAdjustmentController();
