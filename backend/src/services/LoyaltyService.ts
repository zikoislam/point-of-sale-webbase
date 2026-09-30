import { Types, ClientSession } from 'mongoose';
import { LoyaltyConfig, ILoyaltyConfig, ILoyaltyTier } from '../models/LoyaltyConfig';
import { LoyaltyTransaction } from '../models/LoyaltyTransaction';
import { Customer } from '../models/Customer';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { runWithOrg, currentOrgId } from '../middlewares/org.context';

/**
 * The loyalty programme's rules live here — SaleService only asks this service
 * to earn or spend, so checkout never has to know about tiers or expiry.
 *
 * Money returned from here is only ever a *discount value*; the caller decides
 * how it lands in the bill.
 */
export interface EarnResult {
  points: number;
  bonusMultiplier: number;
}

export interface RedeemResult {
  points: number;
  value: number;
}

export class LoyaltyService {
  /** The org's config, created with defaults on first use. */
  async getConfig(session?: ClientSession): Promise<ILoyaltyConfig> {
    const existing = await LoyaltyConfig.findOne().session(session || null).lean();
    if (existing) return existing as unknown as ILoyaltyConfig;
    // orgId is normally stamped by the tenant plugin; passing it here too keeps
    // this working from a job or script that did not load the model barrel.
    const orgId = currentOrgId();
    const created = await LoyaltyConfig.create(
      [{ ...(orgId ? { orgId: new Types.ObjectId(orgId) } : {}) }],
      session ? { session } : {}
    );
    return created[0].toObject() as unknown as ILoyaltyConfig;
  }

  async updateConfig(data: Partial<ILoyaltyConfig>): Promise<ILoyaltyConfig> {
    await this.getConfig(); // make sure one exists
    const config = await LoyaltyConfig.findOneAndUpdate({}, { $set: data }, { new: true, runValidators: true }).lean();
    return config as unknown as ILoyaltyConfig;
  }

  /** The tier a lifetime total currently lands in (and what the next one needs). */
  tierFor(lifetimePoints: number, tiers: ILoyaltyTier[] = []) {
    const ladder = [...tiers]
      .filter((t) => typeof t.minLifetimePoints === 'number')
      .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
    if (ladder.length === 0) return { tier: 'NONE' as const, multiplier: 1, next: null };

    // Someone who has never earned is not on the ladder yet, even though the
    // first rung starts at zero.
    if (lifetimePoints <= 0) {
      const first = ladder[0];
      return {
        tier: 'NONE' as const,
        multiplier: 1,
        next: { name: first.name, minLifetimePoints: first.minLifetimePoints, pointsAway: first.minLifetimePoints },
      };
    }

    let current = ladder[0];
    for (const step of ladder) {
      if (lifetimePoints >= step.minLifetimePoints) current = step;
    }
    const next = ladder.find((t) => t.minLifetimePoints > lifetimePoints) || null;
    return {
      tier: current.name as 'NONE' | 'SILVER' | 'GOLD' | 'PLATINUM',
      multiplier: current.bonusMultiplier || 1,
      next: next
        ? { name: next.name, minLifetimePoints: next.minLifetimePoints, pointsAway: next.minLifetimePoints - lifetimePoints }
        : null,
    };
  }

  /**
   * Points for a bill. The customer's tier multiplier applies, so a GOLD buyer
   * earns faster — that is the whole point of the ladder.
   */
  async calculateEarn(spend: number, customerId?: string | null, session?: ClientSession): Promise<EarnResult & { tier: string; next: any }> {
    const config = await this.getConfig(session);
    if (!config.isActive || !customerId || spend <= 0) {
      return { points: 0, bonusMultiplier: 1, tier: 'NONE', next: null };
    }
    const customer: any = await Customer.findById(customerId).session(session || null).select('lifetimePoints loyaltyTier').lean();
    const { tier, multiplier, next } = this.tierFor(customer?.lifetimePoints || 0, config.tiers || []);
    const base = spend * (config.pointsPerTk || 0);
    return { points: Math.floor(base * multiplier), bonusMultiplier: multiplier, tier, next };
  }

  /**
   * How many points a bill may actually spend: the customer's balance, the
   * programme minimum, and the per-bill ceiling all have to agree.
   */
  async maxRedeemable(customerId: string, billTotal: number, session?: ClientSession) {
    const config = await this.getConfig(session);
    const customer: any = await Customer.findById(customerId).session(session || null).select('loyaltyPoints').lean();
    const balance = customer?.loyaltyPoints || 0;
    const ceilingTk = roundMoney((billTotal * (config.maxRedeemPercent ?? 100)) / 100);
    const ceilingPoints = Math.floor(ceilingTk / (config.redeemValuePerPoint || 1));
    return {
      config,
      balance,
      minPoints: config.minPointsToRedeem || 0,
      maxPoints: Math.max(0, Math.min(balance, ceilingPoints)),
      valuePerPoint: config.redeemValuePerPoint || 0,
    };
  }

  /** Records an earning against a sale, and moves the customer up the ladder. */
  async applyEarn(
    customerId: string,
    saleId: string | null,
    spend: number,
    session?: ClientSession
  ): Promise<EarnResult> {
    const { points, bonusMultiplier } = await this.calculateEarn(spend, customerId, session);
    if (points <= 0) return { points: 0, bonusMultiplier };

    const config = await this.getConfig(session);
    const expiresAt =
      config.expiryDays > 0 ? new Date(Date.now() + config.expiryDays * 24 * 60 * 60 * 1000) : null;

    const customer: any = await Customer.findByIdAndUpdate(
      customerId,
      { $inc: { loyaltyPoints: points, lifetimePoints: points } },
      { new: true, session }
    ).lean();

    const lifetime = customer?.lifetimePoints || points;
    const { tier } = this.tierFor(lifetime, config.tiers || []);
    await Customer.updateOne({ _id: customerId }, { $set: { loyaltyTier: tier } }, { session });

    await LoyaltyTransaction.create(
      [
        {
          ...(currentOrgId() ? { orgId: new Types.ObjectId(currentOrgId() as string) } : {}),
          customerId: new Types.ObjectId(customerId),
          type: 'EARN',
          points,
          balanceAfter: customer?.loyaltyPoints ?? points,
          lifetimeAfter: lifetime,
          relatedSaleId: saleId && Types.ObjectId.isValid(saleId) ? new Types.ObjectId(saleId) : null,
          narration: bonusMultiplier > 1 ? `Earned with a ×${bonusMultiplier} tier bonus` : 'Earned on a sale',
          expiresAt,
        },
      ],
      { session, ordered: true }
    );

    return { points, bonusMultiplier };
  }

  /** Records points spent on a sale. Caller has already validated the balance. */
  async applyRedeem(customerId: string, saleId: string | null, points: number, session?: ClientSession): Promise<RedeemResult> {
    const config = await this.getConfig(session);
    const value = roundMoney(points * (config.redeemValuePerPoint || 0));
    if (points <= 0) return { points: 0, value: 0 };

    const customer: any = await Customer.findByIdAndUpdate(
      customerId,
      { $inc: { loyaltyPoints: -points } },
      { new: true, session }
    ).lean();

    await LoyaltyTransaction.create(
      [
        {
          ...(currentOrgId() ? { orgId: new Types.ObjectId(currentOrgId() as string) } : {}),
          customerId: new Types.ObjectId(customerId),
          type: 'REDEEM',
          points,
          balanceAfter: Math.max(0, customer?.loyaltyPoints ?? 0),
          relatedSaleId: saleId && Types.ObjectId.isValid(saleId) ? new Types.ObjectId(saleId) : null,
          narration: `Redeemed for ${value} off the bill`,
        },
      ],
      { session, ordered: true }
    );

    return { points, value };
  }

  /**
   * Expires earned points that have passed their date.
   *
   * Oldest earning runs first and a customer can never go below zero, so an
   * expiry sweep can only ever take points that are genuinely still unspent.
   * The cron job calls this outside any request, so each organization is
   * re-entered explicitly before its customers are touched.
   */
  async expirePoints(): Promise<{ customers: number; points: number; orgs: number }> {
    const due = await LoyaltyTransaction.find({
      type: 'EARN',
      expired: { $ne: true },
      expiresAt: { $ne: null, $lte: new Date() },
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    let customers = 0;
    let totalPoints = 0;
    const orgs = new Set<string>();

    for (const row of due as any[]) {
      const orgId = row.orgId ? String(row.orgId) : null;
      if (!orgId) continue;

      const outcome = await runWithOrg({ orgId }, async () => {
        const config = await this.getConfig();
        if (!config.isActive || !config.expiryDays) {
          // Programme off or expiry disabled — release the row without expiring.
          await LoyaltyTransaction.updateOne({ _id: row._id }, { $set: { expired: true } });
          return { customers: 0, points: 0 };
        }

        const customer: any = await Customer.findById(row.customerId)
          .select('loyaltyPoints')
          .lean();
        if (!customer) {
          await LoyaltyTransaction.updateOne({ _id: row._id }, { $set: { expired: true } });
          return { customers: 0, points: 0 };
        }

        const spendable = Math.min(row.points, customer.loyaltyPoints || 0);
        if (spendable > 0) {
          const updated: any = await Customer.findByIdAndUpdate(
            row.customerId,
            { $inc: { loyaltyPoints: -spendable } },
            { new: true }
          ).lean();
          await LoyaltyTransaction.create({
            ...(currentOrgId() ? { orgId: new Types.ObjectId(currentOrgId() as string) } : {}),
            customerId: row.customerId,
            type: 'EXPIRE',
            points: spendable,
            balanceAfter: Math.max(0, updated?.loyaltyPoints ?? 0),
            narration: `Expired after ${config.expiryDays} days`,
          });
        }
        await LoyaltyTransaction.updateOne({ _id: row._id }, { $set: { expired: true } });
        return { customers: spendable > 0 ? 1 : 0, points: spendable };
      });

      if (outcome.customers > 0) orgs.add(orgId);
      customers += outcome.customers;
      totalPoints += outcome.points;
    }

    return { customers, points: totalPoints, orgs: orgs.size };
  }

  /** A customer's loyalty statement: balance, tier and the movement history. */
  async getCustomerStatement(customerId: string, page = 1, limit = 30) {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');
    const customer: any = await Customer.findById(customerId)
      .select('name phone loyaltyPoints loyaltyTier lifetimePoints currentDueBalance')
      .lean();
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    const config = await this.getConfig();
    const [transactions, total] = await Promise.all([
      LoyaltyTransaction.find({ customerId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('relatedSaleId', 'invoiceNo totalAmount')
        .lean(),
      LoyaltyTransaction.countDocuments({ customerId }),
    ]);

    const { tier, multiplier, next } = this.tierFor(customer.lifetimePoints || 0, config.tiers || []);

    return {
      customer: {
        id: String(customer._id),
        name: customer.name,
        phone: customer.phone,
        points: customer.loyaltyPoints || 0,
        lifetimePoints: customer.lifetimePoints || 0,
        tier: customer.loyaltyTier || tier,
      },
      program: {
        isActive: config.isActive,
        pointsPerTk: config.pointsPerTk,
        redeemValuePerPoint: config.redeemValuePerPoint,
        minPointsToRedeem: config.minPointsToRedeem,
        maxRedeemPercent: config.maxRedeemPercent,
        expiryDays: config.expiryDays,
        pointValue: roundMoney((customer.loyaltyPoints || 0) * (config.redeemValuePerPoint || 0)),
        tierMultiplier: multiplier,
        nextTier: next,
      },
      transactions,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Programme health: what was earned, spent and lost, who holds the most
   * points, and what those points would cost if everyone redeemed tomorrow.
   */
  async getAnalytics(startDate?: string, endDate?: string) {
    const range: Record<string, any> = {};
    if (startDate) range.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    const match: Record<string, any> = {};
    if (Object.keys(range).length) match.createdAt = range;

    const config = await this.getConfig();

    const [byType, topHolders, activeMembers, tierSplit] = await Promise.all([
      LoyaltyTransaction.aggregate([
        { $match: match },
        { $group: { _id: '$type', points: { $sum: '$points' }, movements: { $sum: 1 } } },
      ]),
      Customer.find({ loyaltyPoints: { $gt: 0 } })
        .select('name phone loyaltyPoints loyaltyTier lifetimePoints')
        .sort({ loyaltyPoints: -1 })
        .limit(20)
        .lean(),
      Customer.countDocuments({ lifetimePoints: { $gt: 0 } }),
      Customer.aggregate([{ $match: { lifetimePoints: { $gt: 0 } } }, { $group: { _id: '$loyaltyTier', customers: { $sum: 1 } } }]),
    ]);

    const pick = (type: string) => (byType as any[]).find((r) => r._id === type);
    const earned = pick('EARN');
    const redeemed = pick('REDEEM');
    const expired = pick('EXPIRE');

    const outstanding = await Customer.aggregate([
      { $match: { loyaltyPoints: { $gt: 0 } } },
      { $group: { _id: null, points: { $sum: '$loyaltyPoints' }, customers: { $sum: 1 } } },
    ]);
    const pointsOutstanding = outstanding[0]?.points || 0;
    const liability = roundMoney(pointsOutstanding * (config.redeemValuePerPoint || 0));

    const redemptionRate = earned?.points ? Math.round(((redeemed?.points || 0) / earned.points) * 1000) / 10 : 0;

    return {
      summary: {
        isActive: config.isActive,
        earnedPoints: earned?.points || 0,
        redeemedPoints: redeemed?.points || 0,
        expiredPoints: expired?.points || 0,
        earnMovements: earned?.movements || 0,
        redeemMovements: redeemed?.movements || 0,
        redemptionRatePercent: redemptionRate,
        pointsOutstanding,
        holders: outstanding[0]?.customers || 0,
        liabilityValue: liability,
        activeMembers,
        pointValue: config.redeemValuePerPoint,
      },
      tiers: (tierSplit as any[])
        .map((t) => ({ tier: t._id || 'NONE', customers: t.customers }))
        .sort((a, b) => b.customers - a.customers),
      topHolders,
      data: (byType as any[]).map((r) => ({ type: r._id, points: r.points, movements: r.movements })),
    };
  }
}

export const loyaltyService = new LoyaltyService();
