import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/AuditService';
import { sendSuccess } from '../utils/api-response';

class AuditController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const entity = req.query.entity as string | undefined;
      const action = req.query.action as string | undefined;
      const userId = req.query.userId as string | undefined;
      const result = await auditService.list(page, limit, entity, action, userId);
      sendSuccess(res, 200, 'Audit logs fetched', result);
    } catch (err) { next(err); }
  }
}

export const auditController = new AuditController();
