import { Request, Response, NextFunction } from 'express';
import { planService } from '../services/PlanService';
import { sendSuccess } from '../utils/api-response';

export class PlanController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query.all === '1' || req.query.all === 'true';
      const plans = await planService.list(includeInactive);
      sendSuccess(res, 200, 'Plans retrieved successfully', plans);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.create(req.body);
      sendSuccess(res, 201, 'Plan created successfully', plan);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Plan updated successfully', plan);
    } catch (error) {
      next(error);
    }
  }

  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.toggle(req.params.id);
      sendSuccess(res, 200, 'Plan status updated', plan);
    } catch (error) {
      next(error);
    }
  }
}

export const planController = new PlanController();
