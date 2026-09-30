/** Module 7 — multi-tier approvals + project P&L, verified in a throwaway org. */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Supplier } from '../models/Supplier';
import { Customer } from '../models/Customer';
import { Sale } from '../models/Sale';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Expense } from '../models/Expense';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { Account } from '../models/Account';
import { JournalEntry } from '../models/JournalEntry';
import { StockMovement } from '../models/StockMovement';
import { Shift } from '../models/Shift';
import { Settings } from '../models/Settings';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { ApprovalWorkflow } from '../models/ApprovalWorkflow';
import { ApprovalRequest } from '../models/ApprovalRequest';
import { Project } from '../models/Project';
import { LetterOfCredit } from '../models/LetterOfCredit';
import { ProformaInvoice } from '../models/ProformaInvoice';
import { CommercialInvoice } from '../models/CommercialInvoice';
import { CnfAgent, CnfAgentLedger } from '../models/CnfAgent';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const ADMIN_USER = 'qa_appr_admin';
const MGR_USER = 'qa_appr_manager';
const CASH_USER = 'qa_appr_cashier';
const ORG_NAME = 'QA Approval Org';

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
    const managerRole: any = await Role.findOne({ orgId, name: 'BRANCH_MANAGER' }).lean();
    const cashierRole: any = await Role.findOne({ orgId, name: 'CASHIER' }).lean();
    console.log(`✓ roles → ADMIN ${!!adminRole} | BRANCH_MANAGER ${!!managerRole} | CASHIER ${!!cashierRole}`);

    await User.deleteMany({ username: { $in: [ADMIN_USER, MGR_USER, CASH_USER] } });
    const mkUser = async (username: string, roleId: any, pin: string, phone: string) =>
      User.create({
        username, fullName: username.replace('qa_appr_', 'QA '), email: `${username}@example.com`, phone,
        passwordHash: 'Probe@123', pinHash: pin, roleId, isActive: true,
        memberships: [{ orgId, roleId, isActive: true }],
      });
    await mkUser(ADMIN_USER, adminRole._id, '1111', '+8801700000001');
    const managerUser: any = await mkUser(MGR_USER, (managerRole || adminRole)._id, '2222', '+8801700000002');
    await mkUser(CASH_USER, (cashierRole || adminRole)._id, '3333', '+8801700000003');

    const login = async (u: string) => {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: 'Probe@123' }) });
      return r.body?.data?.token;
    };
    const adminToken = await login(ADMIN_USER);
    const managerToken = await login(MGR_USER);
    const cashierToken = await login(CASH_USER);
    if (!adminToken || !managerToken || !cashierToken) throw new Error('login failed');
    console.log('✓ three users (ADMIN, BRANCH_MANAGER, CASHIER) ready');

    // ── Setup data ──────────────────────────────────────────────────────────
    const cat: any = await runWithOrg({ orgId }, async () =>
      Category.create({ name: 'QA Appr Cat', code: `QAA${Date.now().toString(36).toUpperCase()}` })
    );
    const supplier = await api('/suppliers', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'Approval Test Supplier', contactPerson: 'Alpha Manager', phone: '+8801711111111' }),
    }, adminToken);
    const supplierId = id(supplier);

    const productRes = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Appr Product', categoryId: String(cat._id), unit: 'Pcs', taxType: 'INCLUSIVE', taxRate: 0,
        variants: [{ attributeName: 'Std', sku: `QA-AP-${Date.now().toString(36).toUpperCase()}`, costPrice: 100, retailSellingPrice: 200, wholesaleSellingPrice: 180, currentStock: 500, alertQty: 5 }],
      }),
    }, adminToken);
    const productId = id(productRes);
    const variantId = productRes.body?.data?.variants?.[0]?._id;

    const cashAccount: any = await runWithOrg({ orgId }, async () =>
      Account.create({ name: 'QA Cash', accountType: 'CASH', currentBalance: 100000, isActive: true })
    );
    const expCat: any = await runWithOrg({ orgId }, async () =>
      ExpenseCategory.create({ name: 'QA Site Cost', code: `QASC${Date.now().toString(36).toUpperCase()}` })
    );
    const customer = await api('/customers', { method: 'POST', body: JSON.stringify({ name: 'QA Project Client', phone: '+8801755555555' }) }, adminToken);
    const customerId = id(customer);
    console.log(`✓ supplier, product, cash account (৳100,000), expense category, customer ready`);

    // PO threshold so purchase orders route through approval at all
    const settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ poApprovalThreshold: 1000 }) }, adminToken);
    console.log(`✓ poApprovalThreshold = ${settings.body?.data?.poApprovalThreshold}`);

    // ── 1. Two-level workflow for purchase orders ───────────────────────────
    const wfRes = await api('/approvals/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'PO above ৳5,000',
        entityType: 'PURCHASE_ORDER',
        minAmount: 5000,
        levels: [
          { level: 1, name: 'Manager review', approverRole: 'BRANCH_MANAGER', requiredApprovals: 1 },
          { level: 2, name: 'Finance approval', approverRole: 'ADMIN', requiredApprovals: 1 },
        ],
      }),
    }, adminToken);
    console.log(`\n1) workflow created → ${wfRes.status} ${wfRes.body?.data?.name} | ${wfRes.body?.data?.levels?.length} level(s)`);
    const badWf = await api('/approvals/workflows', {
      method: 'POST',
      body: JSON.stringify({ name: 'Broken', entityType: 'EXPENSE', levels: [{ name: 'No approver' }] }),
    }, adminToken);
    console.log(`   level without approver → ${badWf.status} ${badWf.body?.error?.code} (expect 400)`);

    // ── 2. PO above the threshold → chain starts ────────────────────────────
    const po = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({ supplierId, items: [{ variantId, productName: 'QA Appr Product', sku: 'QA-AP', orderedQty: 100, unitCost: 100 }] }),
    }, adminToken);
    const poId = id(po);
    const poNumber = po.body?.data?.poNumber;
    console.log(`\n2) PO ${poNumber} ৳10000 → approvalStatus ${po.body?.data?.approvalStatus} (expect PENDING_APPROVAL)`);

    const mgrInbox = await api('/approvals/inbox', {}, managerToken);
    console.log(`   manager inbox → awaiting me ${mgrInbox.body?.data?.summary?.awaitingMe} | value ৳${mgrInbox.body?.data?.summary?.awaitingMeValue}`);
    const reqId = mgrInbox.body?.data?.data?.[0]?._id;

    const cashierTry = await api(`/approvals/${reqId}/approve`, { method: 'PUT', body: JSON.stringify({ comment: 'trying' }) }, cashierToken);
    console.log(`   cashier tries to approve → ${cashierTry.status} ${cashierTry.body?.error?.code} (expect 403 NOT_AN_APPROVER)`);

    const lvl1 = await api(`/approvals/${reqId}/approve`, { method: 'PUT', body: JSON.stringify({ comment: 'Looks fine — verified the quote' }) }, managerToken);
    console.log(`   level 1 approved by the manager → ${lvl1.status} | status ${lvl1.body?.data?.status} | now at level ${lvl1.body?.data?.currentLevel} (expect PENDING / 2)`);

    const poStillPending = await api(`/purchase-orders/${poId}`, {}, adminToken);
    console.log(`   PO while level 2 pending → approvalStatus ${poStillPending.body?.data?.approvalStatus} (expect PENDING_APPROVAL)`);
    const orderTooEarly = await api(`/purchase-orders/${poId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ORDERED' }) }, adminToken);
    console.log(`   sending it to the supplier early → ${orderTooEarly.status} ${orderTooEarly.body?.error?.code} (expect 403)`);

    const adminInbox = await api('/approvals/inbox', {}, adminToken);
    const adminReqId = adminInbox.body?.data?.data?.[0]?._id;
    const dup = await api(`/approvals/${reqId}/approve`, { method: 'PUT', body: JSON.stringify({ comment: 'again' }) }, managerToken);
    console.log(`   approving twice from level 1 → ${dup.status} ${dup.body?.error?.code} (expect 403 NOT_AN_APPROVER at level 2)`);
    const lvl2 = await api(`/approvals/${adminReqId}/approve`, { method: 'PUT', body: JSON.stringify({ comment: 'Budget approved' }) }, adminToken);
    console.log(`   level 2 approved by admin → ${lvl2.status} | final status ${lvl2.body?.data?.status} (expect APPROVED)`);

    const poAfter = await api(`/purchase-orders/${poId}`, {}, adminToken);
    console.log(`   PO after the full chain → approvalStatus ${poAfter.body?.data?.approvalStatus} (expect APPROVED) | approvedAt ${poAfter.body?.data?.approvedAt ? 'set' : 'missing'}`);
    const orderNow = await api(`/purchase-orders/${poId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ORDERED' }) }, adminToken);
    console.log(`   sending it to the supplier now → ${orderNow.status} (expect 200)`);

    // ── 3. Expense chain (posts the journal only after approval) ────────────
    await api('/approvals/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Any expense',
        entityType: 'EXPENSE',
        minAmount: 0,
        levels: [{ level: 1, name: 'Manager review', approverRole: 'BRANCH_MANAGER', requiredApprovals: 1 }],
      }),
    }, adminToken);

    const balanceBefore = (await runWithOrg({ orgId }, async () => Account.findById(cashAccount._id).lean())) as any;
    const expenseRes = await api('/expenses', {
      method: 'POST',
      body: JSON.stringify({ categoryId: String(expCat._id), amount: 5000, accountId: String(cashAccount._id), description: 'Site fuel' }),
    }, managerToken);
    const expenseId = id(expenseRes);
    console.log(`\n3) expense ৳5000 by the manager → ${expenseRes.status} | status ${expenseRes.body?.data?.status} (expect PENDING)`);

    const balanceMid = (await runWithOrg({ orgId }, async () => Account.findById(cashAccount._id).lean())) as any;
    const journalMid = await runWithOrg({ orgId }, async () => JournalEntry.countDocuments({}));
    console.log(`   while pending → cash ৳${balanceMid.currentBalance} (was ৳${balanceBefore.currentBalance}) | journals ${journalMid} (expect unchanged)`);

    const expInbox = await api('/approvals/inbox', {}, managerToken);
    const expReqId = expInbox.body?.data?.data?.find((r: any) => r.entityType === 'EXPENSE')?._id;
    const expApprove = await api(`/approvals/${expReqId}/approve`, { method: 'PUT', body: JSON.stringify({ comment: 'Site cost verified' }) }, managerToken);
    console.log(`   approved through the workflow → ${expApprove.status} | ${expApprove.body?.data?.status}`);

    const expenseAfter = await api(`/expenses/${expenseId}`, {}, adminToken);
    const balanceAfter = (await runWithOrg({ orgId }, async () => Account.findById(cashAccount._id).lean())) as any;
    const journalAfter = await runWithOrg({ orgId }, async () => JournalEntry.countDocuments({}));
    console.log(`   expense status now ${expenseAfter.body?.data?.status || 'APPROVED'} | cash ৳${balanceAfter.currentBalance} (expect 95000) | journals ${journalAfter} (expect 1)`);

    // ── 4. Rejection path ───────────────────────────────────────────────────
    const po2 = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({ supplierId, items: [{ variantId, productName: 'QA Appr Product', sku: 'QA-AP', orderedQty: 80, unitCost: 100 }] }),
    }, adminToken);
    const inbox2 = await api('/approvals/inbox', {}, managerToken);
    const req2 = inbox2.body?.data?.data?.find((r: any) => r.entityRef === po2.body?.data?.poNumber)?._id;
    const reject = await api(`/approvals/${req2}/reject`, { method: 'PUT', body: JSON.stringify({ comment: 'Price too high this month' }) }, managerToken);
    console.log(`\n4) rejection → ${reject.status} | ${reject.body?.data?.status}`);
    const po2After = await api(`/purchase-orders/${id(po2)}`, {}, adminToken);
    console.log(`   PO ${po2.body?.data?.poNumber} → ${po2After.body?.data?.approvalStatus} (expect REJECTED) | reason "${po2After.body?.data?.rejectionReason}"`);

    // ── 5. LC gate ──────────────────────────────────────────────────────────
    await api('/approvals/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Any LC',
        entityType: 'LETTER_OF_CREDIT',
        minAmount: 0,
        levels: [{ level: 1, name: 'Management approval', approverRole: 'ADMIN', requiredApprovals: 1 }],
      }),
    }, adminToken);
    const lcRes = await api('/import-export/lc', {
      method: 'POST',
      body: JSON.stringify({ issuingBank: 'City Bank', currency: 'USD', exchangeRate: 120, lcAmount: 8000, beneficiarySupplierId: supplierId }),
    }, adminToken);
    const lcId = id(lcRes);
    const openTooEarly = await api(`/import-export/lc/${lcId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'OPENED' }) }, adminToken);
    console.log(`\n5) opening the LC without approval → ${openTooEarly.status} ${openTooEarly.body?.error?.code} (expect 409 LC_PENDING_APPROVAL)`);
    const lcInbox = await api('/approvals/inbox', {}, adminToken);
    const lcReqId = lcInbox.body?.data?.data?.find((r: any) => r.entityType === 'LETTER_OF_CREDIT')?._id;
    const lcApprove = await api(`/approvals/${lcReqId}/approve`, { method: 'PUT', body: JSON.stringify({ comment: 'Shipment terms agreed' }) }, adminToken);
    const lcAfter = await api(`/import-export/lc/${lcId}`, {}, adminToken);
    console.log(`   approved → ${lcApprove.status} | LC status now ${lcAfter.body?.data?.status} (expect OPENED)`);

    // ── 6. Projects & P&L ───────────────────────────────────────────────────
    const projectRes = await api('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'QA Showroom Fit-out', budget: 500000, customerId, managerId: String(managerUser._id), status: 'ACTIVE' }),
    }, adminToken);
    const projectId = id(projectRes);
    console.log(`\n6) project created → ${projectRes.status} ${projectRes.body?.data?.code}`);

    // Attach a sale, an expense and the PO to the project
    const shift = await api('/shifts/open', { method: 'POST', body: JSON.stringify({ openingFloat: 1000, terminalId: 'QA-APPR-01' }) }, adminToken);
    const sale = await api('/sales/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-appr-${Date.now()}` },
      body: JSON.stringify({
        customerId, pricingTier: 'WHOLESALE', projectId,
        items: [{ variantId, quantity: 50, pricingTier: 'WHOLESALE' }],
        payments: [{ method: 'CASH', amount: 9000 }],
        clientTimestamp: new Date().toISOString(),
      }),
    }, adminToken);
    console.log(`   shift ${shift.status} | sale against the project → ${sale.status}${sale.status !== 201 ? ` (${sale.body?.error?.code})` : ''}`);

    const projectSale: any = await runWithOrg({ orgId }, async () =>
      Sale.findOne({ projectId: new mongoose.Types.ObjectId(projectId) }).select('invoiceNo totalAmount projectId').lean()
    );
    console.log(`   sale ${projectSale?.invoiceNo} stamped with projectId: ${projectSale?.projectId ? 'YES' : 'NO'}`);

    const projectPo = await runWithOrg({ orgId }, async () =>
      PurchaseOrder.findByIdAndUpdate(poId, { $set: { projectId: new mongoose.Types.ObjectId(projectId) } }, { new: true }).lean()
    );
    const projectExpense = await runWithOrg({ orgId }, async () =>
      Expense.findByIdAndUpdate(expenseId, { $set: { projectId: new mongoose.Types.ObjectId(projectId) } }, { new: true }).lean()
    );
    console.log(`   linked PO ${(projectPo as any)?.poNumber} and expense to the project`);

    const pnl = await api('/reports/project-pnl', {}, adminToken);
    console.log(`   project P&L → projects ${pnl.body?.data?.summary?.projects} | revenue ৳${pnl.body?.data?.summary?.revenue} | purchases ৳${pnl.body?.data?.summary?.purchases} | expenses ৳${pnl.body?.data?.summary?.expenses} | profit ৳${pnl.body?.data?.summary?.profit} | margin ${pnl.body?.data?.summary?.overallMarginPercent}%`);
    for (const r of pnl.body?.data?.data || []) {
      console.log(`     ${r.code} ${r.name}: budget ৳${r.budget} | revenue ৳${r.revenue} | cost ৳${r.totalCost} | profit ৳${r.profit} (${r.marginPercent}%) | budget used ${r.budgetUsedPercent}%`);
    }
    const projDetail = await api(`/projects/${projectId}`, {}, adminToken);
    console.log(`   project detail → ${projDetail.body?.data?.sales?.length} sale(s), ${projDetail.body?.data?.purchaseOrders?.length} PO(s), ${projDetail.body?.data?.expenses?.length} expense(s)`);
    const delProject = await api(`/projects/${projectId}`, { method: 'DELETE' }, adminToken);
    console.log(`   deleting a project with transactions → ${delProject.status} ${delProject.body?.error?.code} (expect 409)`);

    // ── 7. Pending approvals report + exports ───────────────────────────────
    const pendingReport = await api('/reports/pending-approvals', {}, adminToken);
    const ps = pendingReport.body?.data?.summary;
    console.log(`\n7) pending approvals report → pending ${ps?.pending} | value ৳${ps?.pendingValue} | approved ${ps?.approved} | rejected ${ps?.rejected} | avg decision ${ps?.averageDecisionDays}d`);
    console.log(`   ageing: <2d ${ps?.ageing?.under2Days}, 2-5d ${ps?.ageing?.twoTo5Days}, >5d ${ps?.ageing?.over5Days}`);
    console.log(`   by type: ${(ps?.byType || []).map((b: any) => `${b.entityType}:${b.count} (৳${b.amount})`).join(', ') || 'none pending'}`);

    for (const type of ['pending-approvals', 'project-pnl']) {
      const csv = await fetch(`${BASE}/reports/export/${type}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const text = await csv.text();
      console.log(`   export csv ${type.padEnd(18)} → ${csv.status} | ${text.split('\n').filter((l) => l.trim()).length - 1} data row(s)`);
    }
    const pdf = await fetch(`${BASE}/reports/export-pdf/project-pnl`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(`   export pdf project-pnl → ${pdf.status} | ${(Buffer.from(await pdf.arrayBuffer()).length / 1024).toFixed(1)} KB`);

    const notif = await api('/notifications?limit=8', {}, adminToken);
    const titles = (notif.body?.data?.data || notif.body?.data || []).map((n: any) => n.title);
    console.log(`\n   bell: [${titles.slice(0, 6).join(' | ')}]`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        ApprovalRequest.deleteMany({ orgId: oid }), ApprovalWorkflow.deleteMany({ orgId: oid }),
        Project.deleteMany({ orgId: oid }),
        PurchaseOrder.deleteMany({ orgId: oid }), Sale.deleteMany({ orgId: oid }),
        Expense.deleteMany({ orgId: oid }), ExpenseCategory.deleteMany({ orgId: oid }),
        JournalEntry.deleteMany({ orgId: oid }), StockMovement.deleteMany({ orgId: oid }),
        Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Supplier.deleteMany({ orgId: oid }), Customer.deleteMany({ orgId: oid }),
        Account.deleteMany({ orgId: oid }), Shift.deleteMany({ orgId: oid }),
        LetterOfCredit.deleteMany({ orgId: oid }), ProformaInvoice.deleteMany({ orgId: oid }),
        CommercialInvoice.deleteMany({ orgId: oid }), CnfAgent.deleteMany({ orgId: oid }),
        CnfAgentLedger.deleteMany({ orgId: oid }), Settings.deleteMany({ orgId: oid }),
        Role.deleteMany({ orgId: oid }), Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }),
        User.deleteMany({ username: { $in: [ADMIN_USER, MGR_USER, CASH_USER] } }),
        Notification.deleteMany({ orgId: oid }),
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
