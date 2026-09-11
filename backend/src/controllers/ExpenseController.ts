import { Request, Response, NextFunction } from 'express';
import { expenseService } from '../services/ExpenseService';
import { sendSuccess } from '../utils/api-response';

class ExpenseController {
  async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await expenseService.listCategories();
      sendSuccess(res, 200, 'Expense categories fetched', categories);
    } catch (err) { next(err); }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const cat = await expenseService.createCategory(req.body);
      sendSuccess(res, 201, 'Expense category created', cat);
    } catch (err) { next(err); }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const cat = await expenseService.updateCategory(req.params.id, req.body);
      sendSuccess(res, 200, 'Expense category updated', cat);
    } catch (err) { next(err); }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await expenseService.deleteCategory(req.params.id);
      sendSuccess(res, 200, 'Expense category deleted');
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const categoryId = req.query.categoryId as string | undefined;
      const accountId = req.query.accountId as string | undefined;
      const result = await expenseService.listExpenses(page, limit, categoryId, accountId);
      sendSuccess(res, 200, 'Expenses fetched', result);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const expense = await expenseService.createExpense(req.body, userId);
      sendSuccess(res, 201, 'Expense recorded successfully', expense);
    } catch (err) { next(err); }
  }
}

export const expenseController = new ExpenseController();
