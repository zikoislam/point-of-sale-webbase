import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Organization, IOrganization, resolveSubscriptionState } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Settings } from '../models/Settings';
import { AuditLog } from '../models/AuditLog';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';
import { ALL_PERMISSIONS, isValidPermissionSet, ADMIN_PERMISSIONS, MANAGER_PERMISSIONS, CASHIER_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { accountingService } from './AccountingService';
import { ExpenseCategory } from '../models/ExpenseCategory';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org';
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  adminPermissionSet: string[];
  memberCount: number;
  createdAt: Date;
  subscriptionEndsAt: Date | null;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionGraceDays: number;
  daysRemaining: number | null;
}

export interface OrgSummary {
  org: OrgListItem;
  counts: {
    users: number;
    products: number;
    customers: number;
    suppliers: number;
    sales: number;
    purchaseOrders: number;
    expenses: number;
  };
}

export class OrgService {
  private toItem(org: IOrganization, memberCount = 0): OrgListItem {
    const subscription = resolveSubscriptionState(org);
    return {
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      status: org.status,
      contactPhone: org.contactPhone,
      contactEmail: org.contactEmail,
      address: org.address,
      adminPermissionSet: org.adminPermissionSet || [],
      memberCount,
      createdAt: org.createdAt,
      subscriptionEndsAt: subscription.endsAt,
      subscriptionStatus: subscription.status,
      subscriptionPlan: org.subscriptionPlan || 'STANDARD',
      subscriptionGraceDays: subscription.graceDays,
      daysRemaining: subscription.daysRemaining,
    };
  }

  async listOrgs(search?: string): Promise<OrgListItem[]> {
    const filter: Record<string, any> = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const orgs = await Organization.find(filter).sort({ createdAt: -1 }).lean();
    const User = (await import('../models/User')).User;

    const items = await Promise.all(
      orgs.map(async (o: any) => {
        const memberCount = await User.countDocuments({ 'memberships.orgId': o._id, 'memberships.isActive': true });
        return this.toItem(o as IOrganization, memberCount);
      })
    );
    return items;
  }

  /**
   * Creates the org's system roles by intersecting the platform role
   * templates with the permission envelope the Super Admin chose. The
   * envelope is the org's ceiling — nothing inside can exceed it.
   */
  private async provisionOrgRoles(orgId: Types.ObjectId, envelope: string[]): Promise<void> {
    const cap = (perms: string[]) => perms.filter((p) => envelope.includes(p));
    const roles = [
      { name: 'ADMIN', displayName: 'Administrator', permissions: cap(ADMIN_PERMISSIONS) },
      { name: 'BRANCH_MANAGER', displayName: 'Branch / Shop Manager', permissions: cap(MANAGER_PERMISSIONS) },
      { name: 'CASHIER', displayName: 'Cashier / POS Operator', permissions: cap(CASHIER_PERMISSIONS) },
    ];

    for (const r of roles) {
      await Role.findOneAndUpdate(
        { orgId, name: r.name },
        { $set: { ...r, isSystemRole: true, orgId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  /** Seeds the per-org operational data: settings, chart of accounts, expense categories. */
  private async provisionOrgData(orgId: Types.ObjectId): Promise<void> {
    const existingSettings = await Settings.findOne({ orgId }).lean();
    if (!existingSettings) {
      await Settings.create({
        orgId,
        shopName: 'My Organization',
        shopEmail: '',
        currencySymbol: '৳',
        defaultTaxRate: 0,
        allowNegativeStock: false,
        thermalPrinterType: '80mm',
        memoPrintMode: 'thermal',
        memoWidthMm: 210,
        memoHeightMm: 297,
        barcodeLabelFormat: '38mm_x_25mm_2up',
        cashDrawerTriggerCode: '\\x1B\\x70\\x00\\x19\\xFA',
        receiptHeader: 'Welcome to our shop!',
        receiptFooter: 'Thank you for shopping with us! Please come again.',
      });
    }

    await runWithOrg({ orgId: orgId.toString() }, async () => {
      await accountingService.seedChart();
      const categories = [
        { name: 'Shop Rent', code: 'SHOP_RENT' },
        { name: 'Electricity & Utilities', code: 'UTILITIES' },
        { name: 'Staff Salary & Allowance', code: 'STAFF_SALARY' },
        { name: 'Office Stationery & Printing', code: 'STATIONERY' },
        { name: 'Inventory Wastage & Spoilage', code: 'WASTAGE_LOSS' },
        { name: 'Tea & Refreshments', code: 'REFRESHMENT' },
      ];
      for (const c of categories) {
        await ExpenseCategory.findOneAndUpdate(
          { code: c.code },
          { $set: c },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    });
  }

  async createOrg(data: {
    name: string;
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    adminPermissionSet: string[];
  }): Promise<OrgListItem> {
    if (!isValidPermissionSet(data.adminPermissionSet)) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'adminPermissionSet contains unknown permissions');
    }

    let slug = slugify(data.name);
    const clash = await Organization.findOne({ slug }).lean();
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const trialDays = env.SUBSCRIPTION_DEFAULT_TRIAL_DAYS;
    const subscriptionEndsAt =
      env.SUBSCRIPTION_ENFORCED && trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : null;

    const org = await Organization.create({
      name: data.name.trim(),
      slug,
      status: 'ACTIVE',
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      address: data.address,
      adminPermissionSet: data.adminPermissionSet,
      subscriptionEndsAt,
      subscriptionGraceDays: env.SUBSCRIPTION_DEFAULT_GRACE_DAYS,
      subscriptionPlan: env.SUBSCRIPTION_ENFORCED ? 'TRIAL' : 'LIFETIME',
    });

    await this.provisionOrgRoles(org._id, data.adminPermissionSet);
    await this.provisionOrgData(org._id);

    return this.toItem(org);
  }

  async updateOrg(id: string, data: {
    name?: string;
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    status?: 'ACTIVE' | 'SUSPENDED';
  }): Promise<OrgListItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    const org = await Organization.findById(id);
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    if (data.name !== undefined) org.name = data.name;
    if (data.contactPhone !== undefined) org.contactPhone = data.contactPhone;
    if (data.contactEmail !== undefined) org.contactEmail = data.contactEmail;
    if (data.address !== undefined) org.address = data.address;
    if (data.status !== undefined) org.status = data.status;

    await org.save();
    return this.toItem(org);
  }

  async setPermissions(id: string, adminPermissionSet: string[]): Promise<OrgListItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    if (!isValidPermissionSet(adminPermissionSet)) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'adminPermissionSet contains unknown permissions');
    }

    const org = await Organization.findById(id);
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    org.adminPermissionSet = adminPermissionSet;
    await org.save();

    // Keep the org's system roles inside the new envelope. Custom roles are
    // also trimmed so the ceiling holds everywhere immediately.
    await Role.updateMany({ orgId: org._id }, [
      { $set: { permissions: { $setIntersection: ['$permissions', adminPermissionSet] } } },
    ]);

    return this.toItem(org);
  }

  async addMember(id: string, data: { username?: string; userId?: string; roleId: string }, actorId: string): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    const org = await Organization.findById(id).lean();
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    const role = await Role.findOne({ _id: data.roleId, $or: [{ orgId: org._id }, { orgId: null, name: { $ne: 'SUPER_ADMIN' } }] });
    if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found in this organization');

    const user = data.userId
      ? await User.findById(data.userId)
      : await User.findOne({ $or: [{ username: (data.username || '').toLowerCase() }, { email: (data.username || '').toLowerCase() }] });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const already = (user.memberships as any[] || []).some((m) => String(m.orgId) === String(org._id));
    if (already) throw new AppError(409, 'ALREADY_MEMBER', 'User is already a member of this organization');

    user.memberships.push({
      orgId: org._id as Types.ObjectId,
      roleId: role._id as Types.ObjectId,
      isActive: true,
    });
    await user.save();

    await AuditLog.create({
      orgId: org._id,
      userId: actorId,
      action: 'UPDATE',
      entity: 'organizations',
      entityId: String(org._id),
      metadata: { addedMember: user.username, roleId: String(role._id) },
    });

    return { ok: true };
  }

  async setMemberActive(id: string, userId: string, isActive: boolean): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid ID');
    }
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const membership = (user.memberships as any[] || []).find((m) => String(m.orgId) === id);
    if (!membership) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'User is not a member of this organization');

    membership.isActive = isActive;
    await user.save();
    return { ok: true };
  }

  /** Impersonation: issues a token scoped to the org and writes an audit trail. */
  async enterOrg(orgId: string, actorId: string): Promise<{ token: string }> {
    if (!Types.ObjectId.isValid(orgId)) throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    const org = await Organization.findById(orgId).lean();
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    const token = jwt.sign({ userId: actorId, activeOrgId: String(org._id) }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    await AuditLog.create({
      orgId: org._id,
      userId: actorId,
      action: 'UPDATE',
      entity: 'organizations',
      entityId: String(org._id),
      metadata: { action: 'ENTER_ORGANIZATION' },
    });

    return { token };
  }

  async getSummary(id: string): Promise<OrgSummary> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid organization ID');
    const org = await Organization.findById(id).lean();
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');

    const User = (await import('../models/User')).User;
    const memberCount = await User.countDocuments({ 'memberships.orgId': org._id, 'memberships.isActive': true });

    const counts = await runWithOrg({ orgId: String(org._id) }, async () => {
      const { Product } = await import('../models/Product');
      const { Customer } = await import('../models/Customer');
      const { Supplier } = await import('../models/Supplier');
      const { Sale } = await import('../models/Sale');
      const { PurchaseOrder } = await import('../models/PurchaseOrder');
      const { Expense } = await import('../models/Expense');
      const [users, products, customers, suppliers, sales, purchaseOrders, expenses] = await Promise.all([
        User.countDocuments({ 'memberships.orgId': org._id, 'memberships.isActive': true }),
        Product.countDocuments({}),
        Customer.countDocuments({}),
        Supplier.countDocuments({}),
        Sale.countDocuments({}),
        PurchaseOrder.countDocuments({}),
        Expense.countDocuments({}),
      ]);
      return { users, products, customers, suppliers, sales, purchaseOrders, expenses };
    });

    return { org: this.toItem(org as unknown as IOrganization, memberCount), counts };
  }

  /** Platform-admin validation helper used by validators. */
  static readonly ALL_PERMISSIONS = ALL_PERMISSIONS;
}

export const orgService = new OrgService();
