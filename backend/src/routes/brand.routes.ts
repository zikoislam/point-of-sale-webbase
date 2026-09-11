import { Router } from 'express';
import { brandController } from '../controllers/BrandController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();
router.use(authenticate);
router.get('/', requirePermissions('inv:view'), (req, res, next) => brandController.listBrands(req, res, next));
router.post('/', requirePermissions('inv:manage'), (req, res, next) => brandController.createBrand(req, res, next));
router.put('/:id', requirePermissions('inv:manage'), (req, res, next) => brandController.updateBrand(req, res, next));
router.delete('/:id', requirePermissions('inv:manage'), (req, res, next) => brandController.deleteBrand(req, res, next));
export default router;
