import { Types } from 'mongoose';
import { Organization, IOrganization, SubscriptionState, resolveSubscriptionState } from '../models/Organization';
import { AuditLog } from '../models/AuditLog';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SubscriptionDescriptor extends SubscriptionState {
  orgId: string;
  orgName: string;
  plan: string;
  note?: string;
  lastExtendedAt?: Date | null;
  /** Days remaining when the frontend should start warning. */
  warnDays: number;
}

/**
 * Owns read/write access to an organization's subscription window.
 *
 * The per-request gate calls `getCached` on every API call, so states are kept
 * in a short-lived in-memory cache to avoid a DB round-trip on hot paths
 * (10-100ms SLAs). Writes invalidate the entry immediately.
 */
export class SubscriptionService {
  private cache = new Map<string, { state: SubscriptionState; expiresAt: number }>();
  private readonly TTL_MS = 30 * 1000;

  private toDescriptor(org: IOrganization | any, now: Date = new Date()): SubscriptionDescriptor {
    const state = resolveSubscriptionState(org, now);
    return {
      ...state,
      orgId: String(org._id),
      orgName: org.name,
      plan: org.subscriptionPlan || 'STANDARD',
      note: org.subscriptionNote,
      lastExtendedAt: org.lastExtendedAt ?? null,
      warnDays: env.SUBSCRIPTION_WARN_DAYS,
    };
  }

  /** Cheap, cached subscription state — used by the middleware on every request. */
  async getCached(orgId: string): Promise<SubscriptionState> {
    const now = Date.now();
    const hit = this.cache.get(orgId);
    if (hit && hit.expiresAt > now) return hit.state;

    const org = await Organization.findById(orgId).select('subscriptionEndsAt subscriptionGraceDays').lean();
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    const state = resolveSubscriptionState(org as any);
    this.cache.set(orgId, { state, expiresAt: now + this.TTL_MS });
    return state;
  }

  /** Full descriptor for API responses (/auth/me, /subscription). */
  async getForOrg(orgId: string): Promise<SubscriptionDescriptor | null> {
    if (!orgId || !Types.ObjectId.isValid(orgId)) return null;
    const org = await Organization.findById(orgId).lean();
    if (!org) return null;
    return this.toDescriptor(org as any);
  }

  invalidate(orgId: string): void {
    this.cache.delete(orgId);
  }

  /**
   * Extends the subscription by `days`, starting from whichever is later: now
   * or the current end date (so renewing early does not burn remaining time).
   */
  async extend(
    orgId: string,
    days: number,
    actorId: string,
    options: { via?: string; plan?: string; note?: string } = {}
  ): Promise<SubscriptionDescriptor> {
    if (!Types.ObjectId.isValid(orgId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    }
    if (!Number.isFinite(days) || days <= 0) {
      throw new AppError(422, 'INVALID_DURATION', 'Extension days must be a positive number');
    }

    const org = await Organization.findById(orgId);
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    const now = new Date();
    const current = org.subscriptionEndsAt ? new Date(org.subscriptionEndsAt) : null;
    const base = current && current.getTime() > now.getTime() ? current : now;
    const newEndsAt = new Date(base.getTime() + days * MS_PER_DAY);

    org.subscriptionEndsAt = newEndsAt;
    org.lastExtendedAt = now;
    if (options.plan) org.subscriptionPlan = options.plan;
    if (options.note !== undefined) org.subscriptionNote = options.note;
    await org.save();

    this.invalidate(orgId);

    await AuditLog.create({
      orgId: org._id,
      userId: actorId,
      action: 'UPDATE',
      entity: 'organizations',
      entityId: String(org._id),
      metadata: {
        action: 'SUBSCRIPTION_EXTENDED',
        days,
        via: options.via || 'MANUAL',
        subscriptionEndsAt: newEndsAt,
      },
    });

    return this.toDescriptor(org);
  }

  /**
   * Desktop support: mirror the offline licence expiry onto an org, but only
   * when it would move the end date forward (never shorten a paid term).
   */
  async mirrorDesktopExpiry(orgId: string, endsAtIso: string): Promise<void> {
    const parsed = new Date(endsAtIso);
    if (Number.isNaN(parsed.getTime())) return;

    const org = await Organization.findById(orgId);
    if (!org) return;

    const current = org.subscriptionEndsAt ? new Date(org.subscriptionEndsAt) : null;
    if (!current || parsed.getTime() > current.getTime()) {
      org.subscriptionEndsAt = parsed;
      await org.save();
      this.invalidate(orgId);
    }
  }
}

export const subscriptionService = new SubscriptionService();
