import { Router } from 'express';
import { backupController } from '../controllers/BackupController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

// Database snapshots are an administrator concern — gated behind settings:manage,
// the same permission that already protects Settings.
router.use(authenticate);
router.use(requirePermissions('settings:manage'));

router.get('/', (req, res, next) => backupController.list(req, res, next));
router.post('/', (req, res, next) => backupController.create(req, res, next));
router.get('/:name/download', (req, res, next) => backupController.download(req, res, next));
router.delete('/:name', (req, res, next) => backupController.remove(req, res, next));

export default router;
