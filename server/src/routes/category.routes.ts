import { Router } from 'express';
import { categoryController } from '../controllers/CategoryController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();
router.use(authenticate);
router.get('/', requirePermissions('inv:view'), (req, res, next) => categoryController.listCategories(req, res, next));
router.post('/', requirePermissions('inv:manage'), (req, res, next) => categoryController.createCategory(req, res, next));
router.put('/:id', requirePermissions('inv:manage'), (req, res, next) => categoryController.updateCategory(req, res, next));
router.delete('/:id', requirePermissions('inv:manage'), (req, res, next) => categoryController.deleteCategory(req, res, next));
export default router;
