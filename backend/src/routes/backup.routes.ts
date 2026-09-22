import { Router } from 'express';
import { backupController } from '../controllers/BackupController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions, requireSuperAdmin } from '../middlewares/rbac.middleware';
import { backupUpload } from '../middlewares/upload.middleware';

const router = Router();

// Database snapshots are an administrator concern — gated behind settings:manage,
// the same permission that already protects Settings.
router.use(authenticate);
router.use(requirePermissions('settings:manage'));

router.get('/', (req, res, next) => backupController.list(req, res, next));
router.post('/', (req, res, next) => backupController.create(req, res, next));
router.get('/:name/download', (req, res, next) => backupController.download(req, res, next));

// Restoring overwrites live data, so both restore routes are locked to the
// SUPER_ADMIN role itself — not merely to a permission a custom role could be
// granted. This one takes a snapshot file picked from the admin's machine.
router.post(
  '/restore-upload',
  requireSuperAdmin,
  backupUpload.single('file'),
  (req, res, next) => backupController.restoreUpload(req, res, next)
);

router.post('/:name/restore', requireSuperAdmin, (req, res, next) => backupController.restore(req, res, next));

router.delete('/:name', (req, res, next) => backupController.remove(req, res, next));

export default router;
