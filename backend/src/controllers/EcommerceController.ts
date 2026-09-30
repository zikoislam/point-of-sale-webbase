import { Request, Response, NextFunction } from 'express';
import { ecommerceService } from '../services/EcommerceService';
import { sendSuccess } from '../utils/api-response';

export class EcommerceController {
  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await ecommerceService.listOrders(req.query.status as string | undefined);
      sendSuccess(res, 200, 'Online orders retrieved successfully', orders);
    } catch (error) { next(error); }
  }

  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ecommerceService.getOrder(req.params.id);
      sendSuccess(res, 200, 'Online order retrieved successfully', order);
    } catch (error) { next(error); }
  }

  async confirmOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ecommerceService.confirmOrder(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Order confirmed and converted to a sale', result);
    } catch (error) { next(error); }
  }

  async setFulfillmentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ecommerceService.setFulfillmentStatus(req.params.id, req.body.status, req.body.trackingCode);
      sendSuccess(res, 200, 'Order updated successfully', order);
    } catch (error) { next(error); }
  }
}

export const ecommerceController = new EcommerceController();
