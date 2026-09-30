import { Router } from 'express';
import { productGroupController } from '../controllers/ProductGroupController';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createProductGroupSchema, updateProductGroupSchema } from '../validators/product-group.validators';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

router.get('/', requirePermissions('inv:view'), (req, res, next) => productGroupController.list(req, res, next));
router.post('/', requirePermissions('inv:manage'), validate(createProductGroupSchema), (req, res, next) => productGroupController.create(req, res, next));
router.get('/:id/products', requirePermissions('inv:view'), (req, res, next) => productGroupController.getProducts(req, res, next));
router.put('/:id', requirePermissions('inv:manage'), validate(updateProductGroupSchema), (req, res, next) => productGroupController.update(req, res, next));
router.delete('/:id', requirePermissions('inv:manage'), (req, res, next) => productGroupController.remove(req, res, next));

export default router;
