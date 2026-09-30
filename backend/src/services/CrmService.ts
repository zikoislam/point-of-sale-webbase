import { Types } from 'mongoose';
import { LoyaltyConfig, ILoyaltyConfig } from '../models/LoyaltyConfig';
import { CrmActivity, ICrmActivity } from '../models/CrmActivity';
import { Campaign, ICampaign } from '../models/Campaign';
import { Customer } from '../models/Customer';
import { Sale } from '../models/Sale';
import { AppError } from '../utils/app-error';
import { loyaltyService } from './LoyaltyService';
import { UpdateLoyaltyConfigInput, CreateActivityInput, CreateCampaignInput } from '../validators/crm.validators';

export class CrmService {
  // ── loyalty ──────────────────────────────────────────────────────────────
  // The programme rules live in loyaltyService; these keep the CRM endpoints
  // working and add the statement / analytics views on top.
  async getLoyaltyConfig(): Promise<ILoyaltyConfig> {
    return loyaltyService.getConfig();
  }

  async updateLoyaltyConfig(data: UpdateLoyaltyConfigInput): Promise<ILoyaltyConfig> {
    return loyaltyService.updateConfig(data as any);
  }

  async loyaltyReport(): Promise<Array<any>> {
    const customers = await Customer.find({ loyaltyPoints: { $gt: 0 } })
      .select('name phone loyaltyPoints loyaltyTier lifetimePoints priceTierId customerType')
      .sort({ loyaltyPoints: -1 })
      .limit(100)
      .lean();
    return customers as any[];
  }

  /** One customer's loyalty statement (balance, tier, movement history). */
  async loyaltyStatement(customerId: string, page = 1, limit = 30) {
    return loyaltyService.getCustomerStatement(customerId, page, limit);
  }

  /** Programme analytics: earned / spent / expired, liability and top holders. */
  async loyaltyAnalytics(startDate?: string, endDate?: string) {
    return loyaltyService.getAnalytics(startDate, endDate);
  }

  /** Runs the expiry sweep on demand (the daily job calls the same method). */
  async expireLoyaltyPoints() {
    return loyaltyService.expirePoints();
  }

  // ── activities ───────────────────────────────────────────────────────────
  async listActivities(status?: string): Promise<Array<any>> {
    const filter: Record<string, any> = {};
    if (status === 'OPEN' || status === 'DONE') filter.status = status;
    return CrmActivity.find(filter)
      .populate('customerId', 'name phone')
      .populate('assignedToUserId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  async createActivity(data: CreateActivityInput, actorId: string): Promise<ICrmActivity> {
    if (!Types.ObjectId.isValid(data.customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer');
    const activity = await CrmActivity.create({
      customerId: new Types.ObjectId(data.customerId),
      type: data.type,
      subject: data.subject,
      notes: data.notes,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedToUserId: data.assignedToUserId && Types.ObjectId.isValid(data.assignedToUserId) ? new Types.ObjectId(data.assignedToUserId) : null,
      createdById: new Types.ObjectId(actorId),
    });
    return activity.toObject() as unknown as ICrmActivity;
  }

  async setActivityStatus(id: string, action: 'DONE' | 'REOPEN'): Promise<ICrmActivity> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid activity');
    const activity = await CrmActivity.findById(id);
    if (!activity) throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity not found');
    activity.status = action === 'DONE' ? 'DONE' : 'OPEN';
    activity.completedAt = action === 'DONE' ? new Date() : null;
    await activity.save();
    return activity.toObject() as unknown as ICrmActivity;
  }

  async customerTimeline(customerId: string): Promise<Array<any>> {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer');
    return CrmActivity.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  // ── campaigns ────────────────────────────────────────────────────────────
  async listCampaigns(): Promise<Array<any>> {
    return Campaign.find({}).sort({ createdAt: -1 }).limit(100).lean();
  }

  /** Computes the audience for a segment and returns the matching customers. */
  async computeAudience(segment: CreateCampaignInput['segment'] = {}): Promise<Array<any>> {
    const filter: Record<string, any> = { isActive: true };
    if (segment.customerType) filter.customerType = segment.customerType;

    if (segment.minPurchases || segment.minSpend) {
      const pipeline: any[] = [
        { $match: filter },
        {
          $lookup: {
            from: 'sales',
            localField: '_id',
            foreignField: 'customerId',
            as: 'sales',
          },
        },
        {
          $addFields: {
            purchaseCount: { $size: '$sales' },
            totalSpend: { $sum: '$sales.totalAmount' },
            lastPurchase: { $max: '$sales.createdAt' },
          },
        },
        { $match: { 'sales.0': { $exists: true } } },
      ];
      if (segment.minPurchases) pipeline.push({ $match: { purchaseCount: { $gte: segment.minPurchases } } });
      if (segment.minSpend) pipeline.push({ $match: { totalSpend: { $gte: segment.minSpend } } });
      if (segment.inactiveDays) {
        const cutoff = new Date(Date.now() - segment.inactiveDays * 24 * 60 * 60 * 1000);
        pipeline.push({ $match: { $or: [{ lastPurchase: { $lte: cutoff } }, { lastPurchase: { $exists: false } }] } });
      }
      pipeline.push({ $project: { name: 1, phone: 1, purchaseCount: 1, totalSpend: 1 } });
      return Customer.aggregate(pipeline);
    }

    return Customer.find(filter).select('name phone').lean();
  }

  async createCampaign(data: CreateCampaignInput, actorId: string): Promise<ICampaign> {
    const audience = await this.computeAudience(data.segment);
    const campaign = await Campaign.create({
      name: data.name,
      channel: data.channel,
      segment: data.segment || {},
      startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      status: 'DRAFT',
      audienceCount: audience.length,
      message: data.message,
      notes: data.notes,
      createdById: new Types.ObjectId(actorId),
    });
    return campaign.toObject() as unknown as ICampaign;
  }

  async setCampaignStatus(id: string, action: 'RUN' | 'COMPLETE' | 'CANCEL'): Promise<ICampaign> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid campaign');
    const campaign = await Campaign.findById(id);
    if (!campaign) throw new AppError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    campaign.status =
      action === 'RUN' ? 'RUNNING' : action === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED';
    await campaign.save();
    return campaign.toObject() as unknown as ICampaign;
  }

  async campaignAudience(id: string): Promise<Array<any>> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid campaign');
    const campaign: any = await Campaign.findById(id).lean();
    if (!campaign) throw new AppError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    return this.computeAudience(campaign.segment);
  }
}

export const crmService = new CrmService();
