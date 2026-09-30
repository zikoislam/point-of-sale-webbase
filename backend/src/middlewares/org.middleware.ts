import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/api-response';
import { runWithOrg, runWithoutScope } from './org.context';

/**
 * Opens the tenant scope for every org-scoped router. Must run AFTER
 * `authenticate` — it reads the active organization out of the JWT claims.
 *
 * The rest of the handler chain executes inside the AsyncLocalStorage scope,
 * so every Mongoose query and create is transparently isolated per org.
 */
export const requireOrg = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    return;
  }

  if (!req.user.orgId) {
    sendError(
      res,
      403,
      'ORG_CONTEXT_REQUIRED',
      'No active organization selected. Switch to an organization to continue.'
    );
    return;
  }

  runWithOrg({ orgId: req.user.orgId, branchId: req.user.branchId }, next);
};

/** Gate for platform-level (super admin) routes — no tenant scope is opened. */
export const requirePlatformSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    return;
  }

  if (!req.user.isPlatformSuperAdmin) {
    sendError(res, 403, 'PERMISSION_DENIED', 'This action is restricted to the platform Super Admin.');
    return;
  }

  runWithoutScope(next);
};
