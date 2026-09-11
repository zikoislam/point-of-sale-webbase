import { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/CategoryService';
import { sendSuccess } from '../utils/api-response';

export class CategoryController {
  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const flat = req.query.flat === 'true';
      const categories = await categoryService.listCategories(flat);
      sendSuccess(res, 200, 'Categories retrieved', categories);
    } catch (error) { next(error); }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoryService.createCategory(req.body);
      sendSuccess(res, 201, 'Category created', category);
    } catch (error) { next(error); }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoryService.updateCategory(req.params.id, req.body);
      sendSuccess(res, 200, 'Category updated', category);
    } catch (error) { next(error); }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await categoryService.deleteCategory(req.params.id);
      sendSuccess(res, 200, 'Category deleted');
    } catch (error) { next(error); }
  }
}
export const categoryController = new CategoryController();
