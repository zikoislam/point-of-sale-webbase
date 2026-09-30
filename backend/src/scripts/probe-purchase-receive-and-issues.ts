/**
 * Purchase Receive (full) + branch stock issue/approval/incoming/receive.
 *
 * Verifies the whole chain against a real database in a throwaway org:
 *   manual purchase → receive all → stock + cost + status
 *   issue request → manager approval → incoming board → destination receives
 */
import mongoose from 'mongoose';

import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Supplier } from '../models/Supplier';
import { Customer } from '../models/Customer';
import { Branch } from '../models/Branch';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { StockTransfer } from '../models/StockTransfer';
import { StockMovement } from '../models/StockMovement';
import { Sale } from '../models/Sale';
import { Shift } from '../models/Shift';
import { Settings } from '../models/Settings';
import { Account } from '../models/Account';
import { JournalEntry } from '../models/JournalEntry';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { SupplierLedger } from '../models/SupplierLedger';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const ADMIN = 'qa_recv_admin';
const STAFF = 'qa_recv_staff';
const ORG_NAME = 'QA Receive Org';

async function api(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const id = (r: any) => r.body?.data?._id || r.body?.data?.id;

async function run() {
  await connectDB();
  let orgId = '';

  try {
    await Organization.deleteMany({ name: ORG_NAME });
    const org: any = await orgService.createOrg({ name: ORG_NAME, adminPermissionSet: [...ALL_PERMISSIONS] });
    orgId = org.id;

    const adminRole: any = await Role.findOne({ orgId, name: 'ADMIN' }).lean();
    const cashierRole: any = await Role.findOne({ orgId, name: 'CASHIER' }).lean();
    console.log(`✓ roles → ADMIN ${!!adminRole} | CASHIER ${!!cashierRole}`);

    await User.deleteMany({ username: { $in: [ADMIN, STAFF] } });
    const mk = (username: string, roleId: any, phone: string, pin: string) =>
      User.create({
        username, fullName: username.replace('qa_recv_', 'QA '), email: `${username}@example.com`, phone,
        passwordHash: 'Probe@123', pinHash: pin, roleId, isActive: true,
        memberships: [{ orgId, roleId, isActive: true }],
      });
    await mk(ADMIN, adminRole._id, '+8801793000001', '5151');
    await mk(STAFF, (cashierRole || adminRole)._id, '+8801793000002', '5252');

    const login = async (u: string) => {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: 'Probe@123' }) });
      return r.body?.data?.token;
    };
    const adminToken = await login(ADMIN);
    const staffToken = await login(STAFF);
    if (!adminToken || !staffToken) throw new Error('login failed');
    console.log('✓ admin + cashier sessions ready');

    // ── Fixtures: two branches, a product with split stock, one supplier ────
    const mainBranch = await api('/branches', { method: 'POST', body: JSON.stringify({ name: 'Main Warehouse', code: 'WH-001', isHeadOffice: true }) }, adminToken);
    const shopBranch = await api('/branches', { method: 'POST', body: JSON.stringify({ name: 'Uttara Shop', code: 'BR-002' }) }, adminToken);
    const mainId = id(mainBranch);
    const shopId = id(shopBranch);
    console.log(`✓ branches → ${mainBranch.body?.data?.code} (${mainBranch.status}) / ${shopBranch.body?.data?.code} (${shopBranch.status})`);

    const cat: any = await runWithOrg({ orgId }, async () =>
      Category.create({ name: 'QA Recv Cat', code: `QAR${Date.now().toString(36).toUpperCase()}` })
    );
    const supplier = await api('/suppliers', { method: 'POST', body: JSON.stringify({ companyName: 'Receive Supplier', contactPerson: 'Karim Ahmed', phone: '+8801712345000' }) }, adminToken);
    const supplierId = id(supplier);

    // Product stock is split across both branches so the transfers can move it
    const product = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Receive Product', categoryId: String(cat._id), unit: 'Pcs', taxType: 'INCLUSIVE', taxRate: 0,
        variants: [{
          attributeName: 'Std', sku: `QA-RCV-${Date.now().toString(36).toUpperCase()}`, barcode: `QA-RCV-BC-${Date.now()}`,
          costPrice: 100, retailSellingPrice: 220, wholesaleSellingPrice: 200, currentStock: 40, alertQty: 5,
        }],
      }),
    }, adminToken);
    const productId = id(product);
    const variantId = product.body?.data?.variants?.[0]?._id;

    // Split the stock: 30 at the warehouse, 10 at the shop
    await runWithOrg({ orgId }, async () =>
      Product.updateOne(
        { _id: new mongoose.Types.ObjectId(productId), 'variants._id': new mongoose.Types.ObjectId(variantId) },
        {
          $set: {
            'variants.$.branchStock': [
              { branchId: new mongoose.Types.ObjectId(mainId), quantity: 30, updatedAt: new Date() },
              { branchId: new mongoose.Types.ObjectId(shopId), quantity: 10, updatedAt: new Date() },
            ],
          },
        }
      )
    );
    const stockOf = async () => {
      const p: any = await runWithOrg({ orgId }, async () =>
        Product.findOne({ 'variants._id': new mongoose.Types.ObjectId(variantId) }).lean()
      );
      const v: any = (p.variants || []).find((x: any) => String(x._id) === String(variantId));
      const at = (branchId: string) =>
        ((v.branchStock || []).find((e: any) => String(e.branchId) === branchId) || {}).quantity ?? null;
      return { total: v.currentStock, cost: v.costPrice, main: at(mainId), shop: at(shopId) };
    };
    console.log(`✓ product seeded → total ${(await stockOf()).total} (warehouse 30 / shop 10) at cost ৳100`);

    /* ══════════════ 1. MANUAL PURCHASE → FULL RECEIVE ══════════════ */
    console.log('\n── 1. Manual purchase receive ──');

    // A manual purchase sitting in DRAFT — the case the shop reported as unusable
    const manualPo = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId,
        branchId: mainId,
        items: [
          { variantId, productName: 'QA Receive Product', sku: 'QA-RCV', orderedQty: 20, unitCost: 120 },
        ],
        notes: 'Manual purchase — no order step',
      }),
    }, adminToken);
    const manualPoId = id(manualPo);
    console.log(`manual purchase → ${manualPo.status} ${manualPo.body?.data?.poNumber} | status ${manualPo.body?.data?.status} | branch ${mainId ? 'set' : 'none'}`);

    const worklist = await api('/purchase-orders/pending-receive', {}, adminToken);
    const entry = (worklist.body?.data?.data || []).find((r: any) => r.id === manualPoId);
    console.log(`pending-receive worklist → ${worklist.status} | ${worklist.body?.data?.summary?.purchases} purchase(s) | this one: pending qty ${entry?.pendingQty} value ৳${entry?.pendingValue} branch "${entry?.branchName}"`);

    const before = await stockOf();
    const received = await api(`/purchase-orders/${manualPoId}/receive-full`, {
      method: 'POST',
      body: JSON.stringify({ vendorInvoiceNo: 'SUP-INV-7781', paidNow: 1000 }),
    }, adminToken);
    const afterReceive = await stockOf();
    console.log(`receive all → ${received.status} | ${received.body?.message}`);
    console.log(`   status now ${received.body?.data?.status} | received qty ${received.body?.data?.receivedQty}`);
    console.log(`   warehouse stock ${before.main} → ${afterReceive.main} (expect +20) | total ${before.total} → ${afterReceive.total} | cost ৳${before.cost} → ৳${afterReceive.cost} (WAC)`);

    const poAfter = await api(`/purchase-orders/${manualPoId}`, {}, adminToken);
    console.log(`   PO ${poAfter.body?.data?.poNumber} → status ${poAfter.body?.data?.status} | paid ৳${poAfter.body?.data?.paidAmount} | due ৳${poAfter.body?.data?.dueAmount} | invoice ${poAfter.body?.data?.vendorInvoiceNo}`);

    const movements: any[] = await runWithOrg({ orgId }, async () =>
      StockMovement.find({ referenceId: new mongoose.Types.ObjectId(manualPoId) }).select('type quantity branchId').lean()
    );
    console.log(`   stock movements → ${movements.map((m) => `${m.type} ${m.quantity} @branch ${String(m.branchId) === mainId ? 'warehouse' : m.branchId}`).join(', ')}`);

    const ledger: any = await runWithOrg({ orgId }, async () =>
      SupplierLedger.find({ supplierId: new mongoose.Types.ObjectId(supplierId) }).lean()
    );
    console.log(`   supplier ledger → ${ledger.length} entry(ies) | payable now ৳${ledger[0]?.balanceAfter}`);

    const receiveTwice = await api(`/purchase-orders/${manualPoId}/receive-full`, { method: 'POST', body: JSON.stringify({}) }, adminToken);
    console.log(`   receiving it again → ${receiveTwice.status} ${receiveTwice.body?.error?.code} (expect 409)`);

    const worklistAfter = await api('/purchase-orders/pending-receive', {}, adminToken);
    console.log(`   worklist after → ${worklistAfter.body?.data?.summary?.purchases} purchase(s) still waiting`);

    /* ══════════════ 2. BRANCH ISSUE → APPROVAL → INCOMING → RECEIVE ══════════════ */
    console.log('\n── 2. Branch stock issue with manager approval ──');

    // A cashier raises the issue request
    const issue = await api('/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({
        fromBranchId: mainId,
        toBranchId: shopId,
        items: [{ productId, variantId, quantity: 12 }],
        notes: 'Shop needs more stock',
      }),
    }, staffToken);
    const issueId = id(issue);
    console.log(`cashier raises issue → ${issue.status} ${issue.body?.data?.transferNumber} | approval ${issue.body?.data?.approvalStatus} | status ${issue.body?.data?.status}`);
    console.log(`   message: ${issue.body?.message}`);

    const stockWhilePending = await stockOf();
    console.log(`   stock untouched while pending → warehouse ${stockWhilePending.main} / shop ${stockWhilePending.shop} (expect 50 / 10 — approval has not released anything yet)`);

    const staffCannotApprove = await api(`/stock-transfers/${issueId}/approve`, { method: 'PUT', body: JSON.stringify({}) }, staffToken);
    console.log(`   cashier tries to approve → ${staffCannotApprove.status} ${staffCannotApprove.body?.error?.code} (expect 403)`);

    const staffIncoming = await api('/stock-transfers/incoming', {}, staffToken);
    console.log(`   shop's incoming board before approval → ${(staffIncoming.body?.data?.data || []).length} transfer(s) (expect 0)`);

    const queue = await api('/stock-transfers/pending-approval', {}, adminToken);
    console.log(`manager queue → ${queue.body?.data?.summary?.requests} request(s) | value ৳${queue.body?.data?.summary?.value}`);

    const approve = await api(`/stock-transfers/${issueId}/approve`, { method: 'PUT', body: JSON.stringify({ note: 'Approved — release to Uttara' }) }, adminToken);
    const stockAfterApproval = await stockOf();
    console.log(`approve → ${approve.status} | approval ${approve.body?.data?.approvalStatus} | status ${approve.body?.data?.status}`);
    console.log(`   source released → warehouse ${stockAfterApproval.main} (expect 38) | shop still ${stockAfterApproval.shop} (expect 16 after receipt)`);

    // The destination branch now sees it as incoming
    const shopBranchToken = adminToken; // branch-scoped token needs a user in that branch; the board is branch-filtered by query
    const incoming = await api(`/stock-transfers/incoming?branchId=${shopId}`, {}, shopBranchToken);
    const incomingRow = (incoming.body?.data?.data || [])[0];
    console.log(`shop's incoming board → ${incoming.body?.data?.summary?.transfers} transfer(s) | ${incomingRow?.transferNumber} | items: ${(incomingRow?.items || []).map((i: any) => `${i.productName} × ${i.quantity}`).join(', ')}`);

    const receiveTooEarly = await api(`/stock-transfers/${issueId}/receive`, { method: 'PUT', body: JSON.stringify({ items: [{ variantId, quantity: 12 }] }) }, staffToken);
    console.log(`   staff receives (they hold no inv:manage) → ${receiveTooEarly.status} ${receiveTooEarly.body?.error?.code}`);

    const receive = await api(`/stock-transfers/${issueId}/receive`, {
      method: 'PUT',
      body: JSON.stringify({ items: [{ variantId, quantity: 12 }] }),
    }, adminToken);
    const stockFinal = await stockOf();
    console.log(`destination receives → ${receive.status} | status ${receive.body?.data?.status}`);
    console.log(`   FINAL stock → warehouse ${stockFinal.main} | shop ${stockFinal.shop} (expect 38 / 22) | total ${stockFinal.total} (expect 60)`);

    const receiveAgain = await api(`/stock-transfers/${issueId}/receive`, { method: 'PUT', body: JSON.stringify({ items: [{ variantId, quantity: 12 }] }) }, adminToken);
    console.log(`   receiving twice → ${receiveAgain.status} ${receiveAgain.body?.error?.code} (expect 409)`);

    // Rejection path
    const issue2 = await api('/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({ fromBranchId: mainId, toBranchId: shopId, items: [{ productId, variantId, quantity: 5 }] }),
    }, staffToken);
    const issue2Id = id(issue2);
    const reject = await api(`/stock-transfers/${issue2Id}/reject`, { method: 'PUT', body: JSON.stringify({ reason: 'Shop stock is enough for now' }) }, adminToken);
    const stockAfterReject = await stockOf();
    console.log(`reject → ${reject.status} | approval ${reject.body?.data?.approvalStatus} | reason "${reject.body?.data?.rejectionReason}" | stock untouched: ${stockAfterReject.main}/${stockAfterReject.shop}`);

    const sendRejected = await api(`/stock-transfers/${issue2Id}/send`, { method: 'PUT' }, adminToken);
    console.log(`   issuing a rejected request → ${sendRejected.status} ${sendRejected.body?.error?.code} (expect 409)`);

    // A manager issuing directly needs no approval round-trip
    const directIssue = await api('/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({ fromBranchId: mainId, toBranchId: shopId, items: [{ productId, variantId, quantity: 5 }] }),
    }, adminToken);
    console.log(`manager issues directly → ${directIssue.status} | approval ${directIssue.body?.data?.approvalStatus} | status ${directIssue.body?.data?.status} (expect APPROVED / IN_TRANSIT)`);
    const stockDirect = await stockOf();
    console.log(`   warehouse ${stockDirect.main} | shop ${stockDirect.shop} (incoming 5 not yet received)`);

    const notifs = await api('/notifications?limit=6', {}, adminToken);
    const titles = (notifs.body?.data?.data || notifs.body?.data || []).map((n: any) => n.title);
    console.log(`\nbell: [${titles.slice(0, 5).join(' | ')}]`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        StockTransfer.deleteMany({ orgId: oid }), PurchaseOrder.deleteMany({ orgId: oid }),
        StockMovement.deleteMany({ orgId: oid }), SupplierLedger.deleteMany({ orgId: oid }),
        Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Supplier.deleteMany({ orgId: oid }), Customer.deleteMany({ orgId: oid }),
        Branch.deleteMany({ orgId: oid }), Sale.deleteMany({ orgId: oid }),
        Shift.deleteMany({ orgId: oid }), Account.deleteMany({ orgId: oid }),
        JournalEntry.deleteMany({ orgId: oid }), Settings.deleteMany({ orgId: oid }),
        Role.deleteMany({ orgId: oid }), Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }),
        User.deleteMany({ username: { $in: [ADMIN, STAFF] } }), Notification.deleteMany({ orgId: oid }),
        Organization.deleteOne({ _id: oid }),
      ]);
      console.log('\n✓ throwaway org removed');
    }
    await mongoose.disconnect();
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error('PROBE FAILED:', e?.message || e);
  process.exit(1);
});
