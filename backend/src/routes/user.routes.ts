import { Router } from 'express';
import { userController } from '../controllers/UserController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createUserSchema, updateUserSchema, updatePinSchema, updateProfileSchema } from '../validators/user.validators';

const router = Router();

// All user management routes require auth
router.use(authenticate);

// Self-service profile (any authenticated user) — must precede /:id
router.get('/me/profile', (req, res, next) => userController.getMyProfile(req, res, next));
router.patch('/me/profile', validate(updateProfileSchema), (req, res, next) => userController.updateMyProfile(req, res, next));

router.get('/', requirePermissions('users:manage'), (req, res, next) => userController.listUsers(req, res, next));
router.post('/', requirePermissions('users:manage'), validate(createUserSchema), (req, res, next) => userController.createUser(req, res, next));
router.get('/:id', requirePermissions('users:manage'), (req, res, next) => userController.getUserById(req, res, next));
router.put('/:id', requirePermissions('users:manage'), validate(updateUserSchema), (req, res, next) => userController.updateUser(req, res, next));
router.delete('/:id', requirePermissions('users:manage'), (req, res, next) => userController.deactivateUser(req, res, next));
router.patch('/:id/pin', requirePermissions('users:manage'), validate(updatePinSchema), (req, res, next) => userController.updatePin(req, res, next));

export default router;
