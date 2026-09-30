import { Request, Response, NextFunction } from 'express';
import { courierService, CourierProvider } from '../services/CourierService';
import { sendSuccess } from '../utils/api-response';

export class CourierController {
  async providers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Courier providers retrieved', courierService.getProviders());
    } catch (error) { next(error); }
  }

  async listShipments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await courierService.listShipments({
        status: req.query.status as string,
        provider: req.query.provider as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      sendSuccess(res, 200, 'Shipments retrieved', data);
    } catch (error) { next(error); }
  }

  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Courier performance retrieved', await courierService.getCourierStats());
    } catch (error) { next(error); }
  }

  /** Hands an online order to a courier (live API when configured). */
  async createShipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courierService.createShipment(req.params.orderId, req.body, req.user!.userId);
      sendSuccess(
        res,
        201,
        result.mode === 'API'
          ? `Shipment created with ${result.provider} (${result.trackingCode || result.consignmentId})`
          : `Shipment recorded as manual${result.warning ? ` — ${result.warning}` : ''}`,
        result
      );
    } catch (error) { next(error); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courierService.applyStatus(
        req.params.orderId,
        { ...req.body, source: 'MANUAL' },
        req.user!.userId
      );
      sendSuccess(res, 200, `Courier status set to ${result.status}`, result);
    } catch (error) { next(error); }
  }

  /** Public webhook used by Pathao / RedX to push status changes. */
  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = String(req.params.provider || '').toUpperCase() as CourierProvider;
      const token =
        (req.headers['x-webhook-token'] as string) ||
        (req.headers['x-courier-token'] as string) ||
        (req.query.token as string) ||
        req.body?.token;
      const result = await courierService.handleWebhook(provider, req.body || {}, token);
      sendSuccess(res, 200, 'Webhook processed', result);
    } catch (error) { next(error); }
  }
}

export const courierController = new CourierController();
