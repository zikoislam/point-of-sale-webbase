import { Request, Response, NextFunction } from 'express';
import { purchaseReturnService } from '../services/PurchaseReturnService';
import { sendSuccess } from '../utils/api-response';

export class PurchaseReturnController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await purchaseReturnService.create(req.body, req.user!.userId);
      sendSuccess(res, 201, 'Purchase return (debit note) created successfully', doc);
    } catch (error) { next(error); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await purchaseReturnService.list(
        {
          supplierId: req.query.supplierId as string | undefined,
          status: req.query.status as string | undefined,
          startDate: req.query.startDate as string | undefined,
          endDate: req.query.endDate as string | undefined,
        },
        page,
        limit
      );
      sendSuccess(res, 200, 'Purchase returns retrieved successfully', result.data, {
        page: result.page,
        limit,
        totalItems: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await purchaseReturnService.getById(req.params.id);
      sendSuccess(res, 200, 'Purchase return retrieved successfully', doc);
    } catch (error) { next(error); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await purchaseReturnService.updateStatus(req.params.id, req.body.status, req.user!.userId);
      sendSuccess(res, 200, 'Purchase return status updated', doc);
    } catch (error) { next(error); }
  }
}

export const purchaseReturnController = new PurchaseReturnController();
