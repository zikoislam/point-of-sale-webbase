import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/api-response';

export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
      return;
    }

    // Super Admin has unrestricted access to all endpoints
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      sendError(
        res,
        403,
        'PERMISSION_DENIED',
        `Access denied. Required permission(s): ${requiredPermissions.join(', ')}`
      );
      return;
    }

    next();
  };
};

export const requireAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
      return;
    }

    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = permissions.some((perm) => userPermissions.includes(perm));

    if (!hasAny) {
      sendError(
        res,
        403,
        'PERMISSION_DENIED',
        `Access denied. Requires at least one of: ${permissions.join(', ')}`
      );
      return;
    }

    next();
  };
};

/**
 * Hard role gate. Unlike requirePermissions — which a custom role could satisfy
 * by being granted the permission string — this only ever passes for the system
 * SUPER_ADMIN role. Used for irreversible/destructive operations such as
 * restoring a database snapshot.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
    return;
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    sendError(res, 403, 'PERMISSION_DENIED', 'This action is restricted to the Super Admin.');
    return;
  }

  next();
};
