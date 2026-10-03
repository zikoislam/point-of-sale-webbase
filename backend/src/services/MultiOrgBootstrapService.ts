import { Types } from 'mongoose';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Settings } from '../models/Settings';
import { Counter } from '../models/Counter';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Sale } from '../models/Sale';
import { StoreCreditVoucher } from '../models/StoreCreditVoucher';
import { SalesReturn } from '../models/SalesReturn';
import { Shift } from '../models/Shift';
import { Customer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { Supplier } from '../models/Supplier';
import { SupplierLedger } from '../models/SupplierLedger';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { JournalEntry } from '../models/JournalEntry';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { Expense } from '../models/Expense';
import { DailySalesSummary } from '../models/DailySalesSummary';
import { HoldCart } from '../models/HoldCart';
import { StockAdjustment } from '../models/StockAdjustment';
import { ALL_PERMISSIONS } from '../config/permissions';
import { env } from '../config/env';

/**
 * Desktop support: the Electron shell passes the signed offline licence's
 * expiry as DESKTOP_SUBSCRIPTION_ENDS_AT so the local organization's
 * subscription mirrors it. Only ever moves the end date forward; a no-op on
 * the web deployment (the env var is unset there) and when enforcement is off.
 */
async function mirrorDesktopSubscription(orgId: string): Promise<void> {
  if (!env.SUBSCRIPTION_ENFORCED || !env.DESKTOP_SUBSCRIPTION_ENDS_AT) return;
  const parsed = new Date(env.DESKTOP_SUBSCRIPTION_ENDS_AT);
  if (Number.isNaN(parsed.getTime())) return;

  const org = await Organization.findById(orgId);
  if (!org) return;
  const current = org.subscriptionEndsAt ? new Date(org.subscriptionEndsAt) : null;
  if (!current || parsed.getTime() > current.getTime()) {
    org.subscriptionEndsAt = parsed;
    if (!org.subscriptionPlan) org.subscriptionPlan = 'STANDARD';
    await org.save();
  }
}

/**
 * One-time, idempotent migration that turns an existing single-shop database
 * into the multi-organization layout:
 *
 *  1. Creates the default organization (named after the shop in Settings).
 *  2. Stamps `orgId` on every business document that predates tenancy.
 *  3. Attaches every existing user to the default org (their current global
 *     role becomes the membership role). The old SUPER_ADMIN becomes the
 *     platform super admin.
 *  4. Clones sequence counters so invoice/journal numbering continues without
 *     collisions.
 *  5. Rebuilds indexes so the new per-org unique constraints take effect.
 *
 * Runs automatically on server start; also callable as a standalone script.
 */
export async function ensureMultiOrgBootstrap(): Promise<{ created: boolean; orgId?: string }> {
  const existingOrg = await Organization.findOne({}).lean();
  if (existingOrg) {
    await mirrorDesktopSubscription(String(existingOrg._id));
    return { created: false, orgId: String(existingOrg._id) };
  }

  console.log('⚙️  Multi-organization bootstrap: creating the default organization…');

  const settings: any = await Settings.findOne({}).lean();
  const orgName = settings?.shopName || 'Main Organization';

  const org = await Organization.create({
    name: orgName,
    slug: 'main-organization',
    status: 'ACTIVE',
    contactPhone: settings?.shopPhone,
    contactEmail: settings?.shopEmail,
    address: settings?.shopAddress,
    adminPermissionSet: [...ALL_PERMISSIONS],
  });

  // 1. Stamp every business collection with the default org
  const stampTargets: Array<{ model: any; name: string }> = [
    { model: Category, name: 'Category' },
    { model: Brand, name: 'Brand' },
    { model: Product, name: 'Product' },
    { model: StockMovement, name: 'StockMovement' },
    { model: PurchaseOrder, name: 'PurchaseOrder' },
    { model: Sale, name: 'Sale' },
    { model: StoreCreditVoucher, name: 'StoreCreditVoucher' },
    { model: SalesReturn, name: 'SalesReturn' },
    { model: Shift, name: 'Shift' },
    { model: Customer, name: 'Customer' },
    { model: CustomerLedger, name: 'CustomerLedger' },
    { model: Supplier, name: 'Supplier' },
    { model: SupplierLedger, name: 'SupplierLedger' },
    { model: Account, name: 'Account' },
    { model: AccountTransaction, name: 'AccountTransaction' },
    { model: JournalEntry, name: 'JournalEntry' },
    { model: ExpenseCategory, name: 'ExpenseCategory' },
    { model: Expense, name: 'Expense' },
    { model: DailySalesSummary, name: 'DailySalesSummary' },
    { model: HoldCart, name: 'HoldCart' },
    { model: StockAdjustment, name: 'StockAdjustment' },
  ];

  for (const { model, name } of stampTargets) {
    if (!model) {
      console.warn(`   ⚠️ Bootstrap: model ${name} not found, skipped`);
      continue;
    }
    const result = await model.updateMany({ orgId: { $exists: false } }, { $set: { orgId: org._id } });
    if (result.modifiedCount > 0) {
      console.log(`   ✓ ${name}: ${result.modifiedCount} document(s) tagged with the default organization`);
    }
  }

  // 2. Settings: attach to the org (legacy docs already carry the shop data)
  if (settings) {
    await Settings.updateOne({ _id: settings._id }, { $set: { orgId: org._id }, $unset: { isDefault: 1 } });
  }

  // 3. Roles: org-less roles become the default org's roles; SUPER_ADMIN stays platform-level
  await Role.updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId: org._id } }
  );
  await Role.updateMany({ name: 'SUPER_ADMIN' }, { $set: { orgId: null } });
  const superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' }).lean();
  const adminRole = await Role.findOne({ orgId: org._id, name: 'ADMIN' }).lean();

  // The org admin is the owner's right hand: bring their role up to the full
  // envelope so newly shipped modules (SR/HR/Production/CRM/…) are reachable.
  await Role.updateMany(
    { orgId: org._id, name: 'ADMIN' },
    { $set: { permissions: ALL_PERMISSIONS.filter((p) => (org as any).adminPermissionSet.includes(p)) } }
  );

  // 4. Users: memberships for everyone
  const users = await User.find({});
  for (const user of users) {
    const isPlatformSuperAdmin = superAdminRole && String(user.roleId) === String(superAdminRole._id);
    if (isPlatformSuperAdmin) user.isPlatformSuperAdmin = true;

    const hasMembership = (user.memberships as any[] || []).some((m) => String(m.orgId) === String(org._id));
    if (!hasMembership) {
      user.memberships.push({
        orgId: org._id,
        roleId: (isPlatformSuperAdmin && adminRole ? adminRole._id : user.roleId) as Types.ObjectId,
        isActive: true,
      });
    }
    await user.save();
  }

  // 5. Clone sequence counters so numbering continues per org
  const counters = await Counter.find({}).lean();
  for (const c of counters) {
    if (String(c._id).startsWith(`${org._id}_`)) continue;
    await Counter.updateOne(
      { _id: `${org._id}_${c._id}` },
      { $set: { seq: c.seq } },
      { upsert: true }
    );
  }

  // 6. Rebuild indexes so the new per-org unique constraints take effect
  const { syncAllIndexes } = await import('./index-sync-service');
  await syncAllIndexes();

  await mirrorDesktopSubscription(String(org._id));

  console.log(`✅ Multi-organization bootstrap complete — default organization: "${orgName}"`);
  return { created: true, orgId: String(org._id) };
}
