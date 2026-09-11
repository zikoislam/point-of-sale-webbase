import { Router } from 'express';
import { expenseController } from '../controllers/ExpenseController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
} from '../validators/expense-category.validators';
import { createExpenseSchema, queryExpenseSchema } from '../validators/expense.validators';

const router = Router();

router.use(authenticate);

// Expense Categories (Phase 19)
router.get('/categories', requirePermissions('expenses:view'), (req, res, next) => expenseController.listCategories(req, res, next));
router.post('/categories', requirePermissions('expenses:manage'), validate(createExpenseCategorySchema), (req, res, next) => expenseController.createCategory(req, res, next));
router.put('/categories/:id', requirePermissions('expenses:manage'), validate(updateExpenseCategorySchema), (req, res, next) => expenseController.updateCategory(req, res, next));
router.delete('/categories/:id', requirePermissions('expenses:manage'), (req, res, next) => expenseController.deleteCategory(req, res, next));

// Expenses (Phase 22)
router.get('/', requirePermissions('expenses:view'), validate(queryExpenseSchema, 'query'), (req, res, next) => expenseController.list(req, res, next));
router.post('/', requirePermissions('expenses:create'), validate(createExpenseSchema), (req, res, next) => expenseController.create(req, res, next));

export default router;
