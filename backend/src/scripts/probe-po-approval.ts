/** Phase 6.3 — PO approval workflow, verified inside a throwaway organization. */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { PurchaseReturn } from '../models/PurchaseReturn';
import { SupplierLedger } from '../models/SupplierLedger';
import { JournalEntry } from '../models/JournalEntry';
import { StockMovement } from '../models/StockMovement';
import { Category } from '../models/Category';
import { Account } from '../models/Account';
import { Settings } from '../models/Settings';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_po_user';
const ORG_NAME = 'QA PO Approval Org';

async function api(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function run() {
  await connectDB();
  let orgId = '';

  try {
    await Organization.deleteMany({ name: ORG_NAME });
    const org: any = await orgService.createOrg({ name: ORG_NAME, adminPermissionSet: [...ALL_PERMISSIONS] });
    orgId = org.id;
    const adminRole: any = await Role.findOne({ orgId, name: 'ADMIN' }).lean();

    await User.deleteMany({ username: USERNAME });
    await User.create({
      username: USERNAME, fullName: 'QA PO User', email: `${USERNAME}@example.com`, phone: '+8801755555555',
      passwordHash: 'Probe@123', pinHash: '5555', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error('login failed');
    console.log('✓ throwaway org + user ready');

    // 1. set the approval threshold to ৳1000
    const settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ poApprovalThreshold: 1000 }) }, token);
    console.log(`✓ poApprovalThreshold set → ${settings.status} (${settings.body?.data?.poApprovalThreshold})`);

    // 2. product + supplier
    const cat: any = await runWithOrg({ orgId }, () =>
      Category.create({ name: 'QA PO Cat', code: `QAPO${Date.now().toString(36).toUpperCase()}` })
    );
    const productRes = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA PO Product', categoryId: String(cat._id), unit: 'Pcs', taxType: 'INCLUSIVE', taxRate: 0,
        variants: [{ attributeName: 'Std', sku: `QA-PO-${Date.now().toString(36).toUpperCase()}`, costPrice: 100, retailSellingPrice: 150, wholesaleSellingPrice: 140, currentStock: 0, alertQty: 5 }],
      }),
    }, token);
    const variant = productRes.body?.data?.variants?.[0];
    if (!variant) console.log('  product response:', JSON.stringify(productRes.body).slice(0, 400));

    const supplierRes = await api('/suppliers', { method: 'POST', body: JSON.stringify({ companyName: 'QA PO Supplier', contactPerson: 'QA', phone: '+8801555555555' }) }, token);
    const supplierId = supplierRes.body?.data?._id || supplierRes.body?.data?.id;
    if (!supplierId) console.log('  supplier response:', JSON.stringify(supplierRes.body).slice(0, 400));

    const makePo = async (qty: number) => {
      const res = await api('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({ supplierId, items: [{ variantId: variant._id, productName: 'QA PO Product', sku: variant.sku, orderedQty: qty, unitCost: 100 }] }),
      }, token);
      if (!res.body?.data) console.log('  PO response:', JSON.stringify(res.body).slice(0, 400));
      return res.body?.data;
    };

    // 3. above threshold → PENDING_APPROVAL
    const bigPo = await makePo(20); // ৳2000
    console.log(`✓ PO ৳2000 created → approvalStatus: ${bigPo.approvalStatus} (expect PENDING_APPROVAL)`);

    // ── Phase 9.5: the approval request must land in the bell feed ──────────
    const feed = await api('/notifications?limit=10', {}, token);
    const feedRows = feed.body?.data?.data || feed.body?.data || [];
    const approvalNote = feedRows.find((n: any) => n.type === 'PO_APPROVAL');
    console.log(`✓ notifications feed → ${feed.status} | newest: [${feedRows.map((n: any) => n.type).join(', ')}]`);
    console.log(`  PO_APPROVAL notification present: ${approvalNote ? 'YES' : 'NO'}`);

    const unread1 = await api('/notifications/unread-count', {}, token);
    console.log(`✓ unread count → ${unread1.body?.data?.count}`);

    const orderAttempt = await api(`/purchase-orders/${bigPo._id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ORDERED' }) }, token);
    console.log(`✓ mark ORDERED while pending → ${orderAttempt.status} ${orderAttempt.body?.error?.code || ''} (expect 403)`);

    const grnAttempt = await api(`/purchase-orders/${bigPo._id}/grn`, { method: 'POST', body: JSON.stringify({ items: [{ variantId: variant._id, receivedQty: 20, unitCost: 100 }] }) }, token);
    console.log(`✓ GRN while pending → ${grnAttempt.status} ${grnAttempt.body?.error?.code || ''} (expect 403)`);

    const approved = await api(`/purchase-orders/${bigPo._id}/approve`, { method: 'PUT' }, token);
    console.log(`✓ approve → ${approved.status} | approvalStatus: ${approved.body?.data?.approvalStatus}`);

    await api(`/purchase-orders/${bigPo._id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ORDERED' }) }, token);
    const grnAfter = await api(`/purchase-orders/${bigPo._id}/grn`, { method: 'POST', body: JSON.stringify({ items: [{ variantId: variant._id, receivedQty: 20, unitCost: 100 }] }) }, token);
    console.log(`✓ GRN after approval → ${grnAfter.status} (expect 200)`);

    // 4. below threshold → AUTO_APPROVED
    const smallPo = await makePo(5); // ৳500
    console.log(`✓ PO ৳500 created → approvalStatus: ${smallPo.approvalStatus} (expect AUTO_APPROVED)`);

    // 5. reject flow
    const rejectTarget = await makePo(30);
    const rejected = await api(`/purchase-orders/${rejectTarget._id}/reject`, { method: 'PUT', body: JSON.stringify({ reason: 'Price too high this month' }) }, token);
    console.log(`✓ reject → ${rejected.status} | status: ${rejected.body?.data?.approvalStatus} | reason: ${rejected.body?.data?.rejectionReason}`);

    const emptyReason = await api(`/purchase-orders/${rejectTarget._id}/reject`, { method: 'PUT', body: JSON.stringify({ reason: '' }) }, token);
    console.log(`✓ reject without a reason → ${emptyReason.status} (expect 400)`);

    const pendingList = await api('/purchase-orders?approvalStatus=PENDING_APPROVAL', {}, token);
    console.log(`✓ pending-approval filter → ${pendingList.status} | count: ${pendingList.body?.meta?.totalItems ?? (pendingList.body?.data?.data || []).length}`);

    // ── Phase 9.5: read state round-trip ────────────────────────────────────
    if (approvalNote) {
      const readOne = await api(`/notifications/${approvalNote._id}/read`, { method: 'PUT' }, token);
      console.log(`✓ mark one read → ${readOne.status}`);
    }
    const allRead = await api('/notifications/mark-all-read', { method: 'PUT' }, token);
    const unread2 = await api('/notifications/unread-count', {}, token);
    console.log(`✓ mark-all-read → ${allRead.status} | unread now: ${unread2.body?.data?.count} (expect 0)`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        Product.deleteMany({ orgId: oid }), Supplier.deleteMany({ orgId: oid }),
        PurchaseOrder.deleteMany({ orgId: oid }), PurchaseReturn.deleteMany({ orgId: oid }),
        SupplierLedger.deleteMany({ orgId: oid }), JournalEntry.deleteMany({ orgId: oid }),
        StockMovement.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Account.deleteMany({ orgId: oid }), Settings.deleteMany({ orgId: oid }),
        ExpenseCategory.deleteMany({ orgId: oid }), Role.deleteMany({ orgId: oid }),
        Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }), User.deleteMany({ username: USERNAME }),
        Notification.deleteMany({ orgId: oid }),
        Organization.deleteOne({ _id: oid }),
      ]);
      console.log('✓ throwaway org removed');
    }
    await mongoose.disconnect();
  }
  process.exit(0);
}

run().catch(async (err) => {
  console.error('PROBE FAILED:', err.message);
  try {
    await User.deleteMany({ username: USERNAME });
    await Organization.deleteMany({ name: ORG_NAME });
    await mongoose.disconnect();
  } catch { /* ignore */ }
  process.exit(1);
});
