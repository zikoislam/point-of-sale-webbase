import { Request, Response, NextFunction } from 'express';
import { crmService } from '../services/CrmService';
import { sendSuccess } from '../utils/api-response';

export class CrmController {
  async getLoyaltyConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await crmService.getLoyaltyConfig();
      sendSuccess(res, 200, 'Loyalty config retrieved', config);
    } catch (error) { next(error); }
  }

  async updateLoyaltyConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await crmService.updateLoyaltyConfig(req.body);
      sendSuccess(res, 200, 'Loyalty config updated', config);
    } catch (error) { next(error); }
  }

  async loyaltyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await crmService.loyaltyReport();
      sendSuccess(res, 200, 'Loyalty report retrieved', rows);
    } catch (error) { next(error); }
  }

  /**
   * The handful of loyalty numbers the till needs. Kept separate from the full
   * config because a cashier holds `pos:checkout`, not `crm:view`.
   */
  async loyaltyForPos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await crmService.getLoyaltyConfig();
      sendSuccess(res, 200, 'Loyalty till settings retrieved', {
        isActive: config.isActive,
        redeemValuePerPoint: config.redeemValuePerPoint,
        minPointsToRedeem: config.minPointsToRedeem,
        maxRedeemPercent: config.maxRedeemPercent,
        pointsPerTk: config.pointsPerTk,
      });
    } catch (error) { next(error); }
  }

  /** One customer's loyalty statement: balance, tier, movement history. */
  async loyaltyStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const statement = await crmService.loyaltyStatement(req.params.customerId, page, limit);
      sendSuccess(res, 200, 'Loyalty statement retrieved', statement);
    } catch (error) { next(error); }
  }

  /** Programme analytics — earned, redeemed, expired, liability. */
  async loyaltyAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await crmService.loyaltyAnalytics(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Loyalty analytics retrieved', analytics);
    } catch (error) { next(error); }
  }

  /** Runs the points expiry sweep now (the daily job uses the same code). */
  async expireLoyaltyPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await crmService.expireLoyaltyPoints();
      sendSuccess(res, 200, 'Loyalty expiry sweep completed', result);
    } catch (error) { next(error); }
  }

  async listActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await crmService.listActivities(req.query.status as string | undefined);
      sendSuccess(res, 200, 'Activities retrieved', rows);
    } catch (error) { next(error); }
  }

  async createActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activity = await crmService.createActivity(req.body, req.user!.userId);
      sendSuccess(res, 201, 'Activity created', activity);
    } catch (error) { next(error); }
  }

  async setActivityStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activity = await crmService.setActivityStatus(req.params.id, req.body.action);
      sendSuccess(res, 200, 'Activity updated', activity);
    } catch (error) { next(error); }
  }

  async customerTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await crmService.customerTimeline(req.params.customerId);
      sendSuccess(res, 200, 'Customer timeline retrieved', rows);
    } catch (error) { next(error); }
  }

  async listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await crmService.listCampaigns();
      sendSuccess(res, 200, 'Campaigns retrieved', rows);
    } catch (error) { next(error); }
  }

  async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await crmService.createCampaign(req.body, req.user!.userId);
      sendSuccess(res, 201, 'Campaign created', campaign);
    } catch (error) { next(error); }
  }

  async setCampaignStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await crmService.setCampaignStatus(req.params.id, req.body.action);
      sendSuccess(res, 200, 'Campaign updated', campaign);
    } catch (error) { next(error); }
  }

  async campaignAudience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await crmService.campaignAudience(req.params.id);
      sendSuccess(res, 200, 'Campaign audience retrieved', rows);
    } catch (error) { next(error); }
  }
}

export const crmController = new CrmController();
