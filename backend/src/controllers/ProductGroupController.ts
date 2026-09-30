import { Request, Response, NextFunction } from 'express';
import { productGroupService } from '../services/ProductGroupService';
import { sendSuccess } from '../utils/api-response';

export class ProductGroupController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await productGroupService.list(req.user?.orgId);
      sendSuccess(res, 200, 'Product groups retrieved successfully', groups);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await productGroupService.create(req.body, req.user?.orgId);
      sendSuccess(res, 201, 'Product group created successfully', group);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await productGroupService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Product group updated successfully', group);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productGroupService.delete(req.params.id);
      sendSuccess(res, 200, 'Product group deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await productGroupService.getProductsByGroup(req.params.id, req.user?.orgId);
      sendSuccess(res, 200, 'Group products retrieved successfully', products);
    } catch (error) {
      next(error);
    }
  }
}

export const productGroupController = new ProductGroupController();
