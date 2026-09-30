import { Request, Response, NextFunction } from 'express';
import { volumePricingService } from '../services/VolumePricingService';
import { sendSuccess } from '../utils/api-response';

export class VolumePricingController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rules = await volumePricingService.list(req.query.productId as string | undefined);
      sendSuccess(res, 200, 'Volume pricing rules retrieved successfully', rules);
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rule = await volumePricingService.create(req.body);
      sendSuccess(res, 201, 'Volume pricing rule created successfully', rule);
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rule = await volumePricingService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Volume pricing rule updated successfully', rule);
    } catch (error) { next(error); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await volumePricingService.delete(req.params.id);
      sendSuccess(res, 200, 'Volume pricing rule deleted successfully');
    } catch (error) { next(error); }
  }

  /** POS lookup: which volume tier applies to this product + qty + customer type. */
  async applicable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.query.productId as string;
      const qty = Number(req.query.qty) || 0;
      const customerType = ((req.query.customerType as string) || 'RETAIL').toUpperCase() as 'RETAIL' | 'WHOLESALE' | 'ALL';
      const variantId = req.query.variantId as string | undefined;

      const result = await volumePricingService.getApplicableDiscount(productId, qty, customerType, variantId);
      sendSuccess(res, 200, 'Applicable volume discount', result);
    } catch (error) { next(error); }
  }
}

export const volumePricingController = new VolumePricingController();
