import { Request, Response, NextFunction } from 'express';
import { purchaseOrderService } from '../services/PurchaseOrderService';
import { sendSuccess } from '../utils/api-response';

class PurchaseOrderController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const supplierId = req.query.supplierId as string | undefined;
      const result = await purchaseOrderService.list(page, limit, status, supplierId);
      sendSuccess(res, 200, 'Purchase orders fetched', result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const po = await purchaseOrderService.getById(req.params.id);
      sendSuccess(res, 200, 'Purchase order fetched', po);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const po = await purchaseOrderService.create(req.body, userId);
      sendSuccess(res, 201, 'Purchase order created', po);
    } catch (err) { next(err); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const po = await purchaseOrderService.updateStatus(req.params.id, status);
      sendSuccess(res, 200, 'Purchase order status updated', po);
    } catch (err) { next(err); }
  }

  async receiveGRN(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const po = await purchaseOrderService.receiveGRN(req.params.id, req.body, userId);
      sendSuccess(res, 200, 'GRN received successfully', po);
    } catch (err) { next(err); }
  }
}

export const purchaseOrderController = new PurchaseOrderController();
