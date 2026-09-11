import { Router } from 'express';
import { productController } from '../controllers/ProductController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();
router.use(authenticate);

// Barcode lookup MUST be before /:id to avoid route conflict
router.get('/barcode/:barcode', requirePermissions('inv:view'), (req, res, next) => productController.getProductByBarcode(req, res, next));

router.get('/', requirePermissions('inv:view'), (req, res, next) => productController.listProducts(req, res, next));
router.get('/:id', requirePermissions('inv:view'), (req, res, next) => productController.getProductById(req, res, next));
router.post('/', requirePermissions('inv:manage'), (req, res, next) => productController.createProduct(req, res, next));
router.put('/:id', requirePermissions('inv:manage'), (req, res, next) => productController.updateProduct(req, res, next));
router.delete('/:id', requirePermissions('inv:manage'), (req, res, next) => productController.deleteProduct(req, res, next));

export default router;
