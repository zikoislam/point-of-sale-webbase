import { Router } from 'express';
import { uploadController } from '../controllers/UploadController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyPermission } from '../middlewares/rbac.middleware';
import { imageUpload } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

// Product images / shop logo
router.post(
  '/image',
  requireAnyPermission('inv:manage', 'settings:manage'),
  imageUpload.single('image'),
  (req, res, next) => uploadController.uploadImage(req, res, next)
);

// Personal profile picture — any authenticated user
router.post(
  '/avatar',
  imageUpload.single('image'),
  (req, res, next) => uploadController.uploadImage(req, res, next)
);

export default router;
