import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/ProductService';
import { sendSuccess } from '../utils/api-response';

export class ProductController {
  async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, search, categoryId, brandId, lowStock, isLowStock, isActive } = req.query;
      const result = await productService.listProducts({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        search: search as string | undefined,
        categoryId: categoryId as string | undefined,
        brandId: brandId as string | undefined,
        lowStock: lowStock === 'true' || isLowStock === 'true',
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        userRole: req.user?.role,
      });
      sendSuccess(res, 200, 'Products retrieved', result.products, {
        page: result.page, limit: result.limit,
        totalItems: result.total, totalPages: result.totalPages,
      });
    } catch (error) { next(error); }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.getProductById(req.params.id, req.user?.role);
      sendSuccess(res, 200, 'Product retrieved', product);
    } catch (error) { next(error); }
  }

  async getProductByBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.getProductByBarcode(req.params.barcode, req.user?.role);
      sendSuccess(res, 200, 'Product retrieved', product);
    } catch (error) { next(error); }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.createProduct(req.body);
      sendSuccess(res, 201, 'Product created', product);
    } catch (error) { next(error); }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      sendSuccess(res, 200, 'Product updated', product);
    } catch (error) { next(error); }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productService.deleteProduct(req.params.id);
      sendSuccess(res, 200, 'Product deleted');
    } catch (error) { next(error); }
  }
}
export const productController = new ProductController();
