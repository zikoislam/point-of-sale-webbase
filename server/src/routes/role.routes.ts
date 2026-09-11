import { Router } from 'express';
import { roleController } from '../controllers/RoleController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createRoleSchema, updateRoleSchema } from '../validators/role.validators';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('roles:view'), (req, res, next) => roleController.listRoles(req, res, next));
router.get('/permissions', requirePermissions('roles:view'), (req, res, next) => roleController.getAllPermissions(req, res, next));
router.post('/', requirePermissions('roles:manage'), validate(createRoleSchema), (req, res, next) => roleController.createRole(req, res, next));
router.put('/:id', requirePermissions('roles:manage'), validate(updateRoleSchema), (req, res, next) => roleController.updateRole(req, res, next));

export default router;
