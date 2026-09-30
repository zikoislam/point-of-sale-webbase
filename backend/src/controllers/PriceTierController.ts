import { Request, Response, NextFunction } from 'express';
import { priceTierService } from '../services/PriceTierService';
import { sendSuccess } from '../utils/api-response';

export class PriceTierController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tiers = await priceTierService.list();
      sendSuccess(res, 200, 'Price tiers retrieved successfully', tiers);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tier = await priceTierService.create(req.body);
      sendSuccess(res, 201, 'Price tier created successfully', tier);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tier = await priceTierService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Price tier updated successfully', tier);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await priceTierService.remove(req.params.id);
      sendSuccess(res, 200, 'Price tier deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const priceTierController = new PriceTierController();
