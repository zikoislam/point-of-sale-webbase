import { Request, Response, NextFunction } from 'express';
import { licenseService } from '../services/LicenseService';
import { subscriptionService } from '../services/SubscriptionService';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

export class LicenseController {
  /** Tenant side: the caller's current subscription state. */
  async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscription = await subscriptionService.getForOrg(req.user!.orgId!);
      if (!subscription) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
      sendSuccess(res, 200, 'Subscription retrieved successfully', subscription);
    } catch (error) {
      next(error);
    }
  }

  /** Tenant side: redeem a license key, extending the subscription. */
  async redeem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, machineId } = req.body as { key: string; machineId?: string };
      const { license, subscription } = await licenseService.redeem(key, req.user!.userId, machineId);
      sendSuccess(res, 200, 'License key redeemed successfully', {
        subscription,
        license: {
          key: license.key,
          days: license.days,
          plan: license.plan,
          redeemedAt: license.redeemedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ---- Platform (Super Admin) side --------------------------------------

  async generateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const license = await licenseService.generate(
        { orgId: req.params.id, ...req.body },
        req.user!.userId
      );
      sendSuccess(res, 201, 'License key generated successfully', license);
    } catch (error) {
      next(error);
    }
  }

  async listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const keys = await licenseService.list(req.params.id, req.query.status as any);
      sendSuccess(res, 200, 'License keys retrieved successfully', keys);
    } catch (error) {
      next(error);
    }
  }

  async revokeKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const license = await licenseService.revoke(req.params.keyId, req.user!.userId);
      sendSuccess(res, 200, 'License key revoked successfully', license);
    } catch (error) {
      next(error);
    }
  }

  async extendSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscription = await subscriptionService.extend(
        req.params.id,
        req.body.days,
        req.user!.userId,
        { via: 'MANUAL', plan: req.body.plan, note: req.body.note }
      );
      sendSuccess(res, 200, 'Subscription extended successfully', subscription);
    } catch (error) {
      next(error);
    }
  }
}

export const licenseController = new LicenseController();
