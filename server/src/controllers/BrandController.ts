import { Request, Response, NextFunction } from 'express';
import { brandService } from '../services/BrandService';
import { sendSuccess } from '../utils/api-response';

export class BrandController {
  async listBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brands = await brandService.listBrands();
      sendSuccess(res, 200, 'Brands retrieved', brands);
    } catch (error) { next(error); }
  }

  async createBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brand = await brandService.createBrand(req.body);
      sendSuccess(res, 201, 'Brand created', brand);
    } catch (error) { next(error); }
  }

  async updateBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brand = await brandService.updateBrand(req.params.id, req.body);
      sendSuccess(res, 200, 'Brand updated', brand);
    } catch (error) { next(error); }
  }

  async deleteBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await brandService.deleteBrand(req.params.id);
      sendSuccess(res, 200, 'Brand deleted');
    } catch (error) { next(error); }
  }
}
export const brandController = new BrandController();
