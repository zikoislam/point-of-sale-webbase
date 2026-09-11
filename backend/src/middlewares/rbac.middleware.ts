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
