import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';
import { subscriptionService } from '../services/SubscriptionService';

/**
 * Subscription gate for every organization-scoped route.
 *
 * Runs after `requireOrg` (so `req.user.orgId` is set). When the organization's
 * subscription is past its grace window it answers 402 Payment Required; the
 * frontend turns that into the "Software Locked" page. During the grace window
 * requests pass through with an `X-Subscription-Status: grace` header so the UI
 * can show a renewal banner.
 *
 * Exemptions: the master switch (`SUBSCRIPTION_ENFORCED=false`) and the platform
 * Super Admin (the owner must always be able to administer a locked tenant).
 * Routes that must keep working while locked (auth, license redemption) are
 * deliberately mounted outside this middleware.
 */
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!env.SUBSCRIPTION_ENFORCED) return next();

    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
      return;
    }

    if (req.user.isPlatformSuperAdmin || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!req.user.orgId) {
      sendError(res, 403, 'ORG_CONTEXT_REQUIRED', 'No active organization selected.');
      return;
    }

    const state = await subscriptionService.getCached(req.user.orgId);

    if (state.status === 'EXPIRED') {
      sendError(
        res,
        402,
        'SUBSCRIPTION_EXPIRED',
        'Your organization\u2019s subscription has expired. Enter a valid license key to continue.',
        [
          {
            endsAt: state.endsAt,
            graceDays: state.graceDays,
            daysOverdue: state.daysOverdue,
          },
        ]
      );
      return;
    }

    if (state.status === 'GRACE') {
      res.setHeader('X-Subscription-Status', 'grace');
    }

    return next();
  } catch (error) {
    if (error instanceof AppError && error.errorCode === 'ORG_NOT_FOUND') {
      sendError(res, 403, 'ORG_NOT_FOUND', 'Organization not found.');
      return;
    }
    next(error);
  }
};
