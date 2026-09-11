import { Router } from 'express';
import { auditController } from '../controllers/AuditController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { queryAuditLogsSchema } from '../validators/audit.validators';

const router = Router();

router.use(authenticate);

router.get('/', requirePermissions('audit:view'), validate(queryAuditLogsSchema, 'query'), (req, res, next) => auditController.list(req, res, next));

export default router;
