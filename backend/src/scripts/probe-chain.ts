/** Phase 7.1 — multi-branch chain + stock transfers, verified in a throwaway org. */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Branch } from '../models/Branch';
import { StockTransfer } from '../models/StockTransfer';
import { StockMovement } from '../models/StockMovement';
import { Sale } from '../models/Sale';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Shift } from '../models/Shift';
import { Expense } from '../models/Expense';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_chain_user';
const ORG_NAME = 'QA Chain Org';

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

const variantStock = async (productId: string, variantId: string) => {
  const p: any = await Product.findById(productId).lean();
  const v = p.variants.find((x: any) => String(x._id) === String(variantId));
  const split = (v.branchStock || []).map((e: any) => ({ branchId: String(e.branchId), qty: e.quantity }));
  return { currentStock: v.currentStock, split };
};

async function run() {
  await connectDB();
  let orgId = '';

  try {
    await Organization.deleteMany({ name: ORG_NAME });
    const org: any = await orgService.createOrg({ name: ORG_NAME, adminPermissionSet: [...ALL_PERMISSIONS] });
    orgId = org.id;
    const adminRole: any = await Role.findOne({ orgId, name: 'ADMIN' }).lean();

    await User.deleteMany({ username: USERNAME });
    const probeUser: any = await User.create({
      username: USERNAME, fullName: 'QA Chain User', email: `${USERNAME}@example.com`, phone: '+8801766666666',
      passwordHash: 'Probe@123', pinHash: '6666', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });
    const myUserId = String(probeUser._id);

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error('login failed');
    console.log('✓ throwaway org + user ready');

    // ── 1. Branches ─────────────────────────────────────────────────────────
    const mainRes = await api('/branches', {
      method: 'POST',
      body: JSON.stringify({ name: 'Main Showroom', code: 'BR-001', city: 'Dhaka', isHeadOffice: true }),
    }, token);
    const mainId = mainRes.body?.data?._id || mainRes.body?.data?.id;
    console.log(`✓ branch BR-001 created → ${mainRes.status} ${mainId ? 'OK' : JSON.stringify(mainRes.body).slice(0, 200)}`);

    const secondRes = await api('/branches', {
      method: 'POST',
      body: JSON.stringify({ name: 'Uttara Branch', code: 'BR-002', city: 'Dhaka' }),
    }, token);
    const secondId = secondRes.body?.data?._id || secondRes.body?.data?.id;
    console.log(`✓ branch BR-002 created → ${secondRes.status}`);

    const dup = await api('/branches', { method: 'POST', body: JSON.stringify({ name: 'Dup', code: 'BR-001' }) }, token);
    console.log(`✓ duplicate branch code → ${dup.status} ${dup.body?.error?.code} (expect 409)`);

    const list = await api('/branches', {}, token);
    console.log(`✓ branch list → ${list.status} | count: ${list.body?.data?.length} | todaySales on HQ: ${list.body?.data?.[0]?.todaySales}`);

    // ── 2. Product with stock at the org level (no split yet) ───────────────
    const cat: any = await runWithOrg({ orgId }, () =>
      Category.create({ name: 'QA Chain Cat', code: `QACH${Date.now().toString(36).toUpperCase()}` })
    );
    const productRes = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Chain Product', categoryId: String(cat._id), unit: 'Pcs', taxType: 'INCLUSIVE', taxRate: 0,
        variants: [{ attributeName: 'Std', sku: `QA-CH-${Date.now().toString(36).toUpperCase()}`, costPrice: 100, retailSellingPrice: 150, wholesaleSellingPrice: 140, currentStock: 100, alertQty: 5 }],
      }),
    }, token);
    const productId = productRes.body?.data?._id || productRes.body?.data?.id;
    const variantId = productRes.body?.data?.variants?.[0]?._id;
    if (!variantId) throw new Error(`product create failed: ${JSON.stringify(productRes.body).slice(0, 300)}`);
    console.log(`✓ product created with 100 units (org-wide, unsplit)`);

    const before = await variantStock(productId, variantId);
    console.log(`  before transfer → currentStock: ${before.currentStock} | split: ${JSON.stringify(before.split)}`);

    // ── 3. Stock transfer BR-001 → BR-002 (20 units) ────────────────────────
    const transferRes = await api('/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({
        fromBranchId: mainId, toBranchId: secondId,
        items: [{ productId, variantId, quantity: 20 }],
        notes: 'QA chain transfer',
      }),
    }, token);
    const transfer = transferRes.body?.data;
    console.log(`✓ transfer created → ${transferRes.status} ${transfer?.transferNumber} (status ${transfer?.status})`);

    // over-transfer must be rejected
    const tooMuch = await api('/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({ fromBranchId: mainId, toBranchId: secondId, items: [{ productId, variantId, quantity: 99999 }] }),
    }, token);
    console.log(`✓ over-transfer → ${tooMuch.status} ${tooMuch.body?.error?.code} (expect 400 INSUFFICIENT_STOCK)`);

    // same-branch guard
    const same = await api('/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({ fromBranchId: mainId, toBranchId: mainId, items: [{ productId, variantId, quantity: 1 }] }),
    }, token);
    console.log(`✓ same-branch transfer → ${same.status} ${same.body?.error?.code} (expect 400 SAME_BRANCH)`);

    const sent = await api(`/stock-transfers/${transfer._id}/send`, { method: 'PUT' }, token);
    if (sent.status !== 200) console.log('  send body:', JSON.stringify(sent.body).slice(0, 300));
    const inTransit = await variantStock(productId, variantId);
    console.log(`✓ dispatched → ${sent.status} | in-transit stock: currentStock ${inTransit.currentStock} | split ${JSON.stringify(inTransit.split)}`);

    const badReceive = await api(`/stock-transfers/${transfer._id}/receive`, {
      method: 'PUT',
      body: JSON.stringify({ items: [{ variantId, quantity: 999 }] }),
    }, token);
    console.log(`✓ receive more than sent → ${badReceive.status} ${badReceive.body?.error?.code} (expect 400)`);

    const received = await api(`/stock-transfers/${transfer._id}/receive`, {
      method: 'PUT',
      body: JSON.stringify({ items: [{ variantId, quantity: 18 }] }), // 2 short
    }, token);
    const after = await variantStock(productId, variantId);
    const mainQty = after.split.find((s: any) => s.branchId === mainId)?.qty;
    const secondQty = after.split.find((s: any) => s.branchId === secondId)?.qty;
    console.log(`✓ received (18 of 20) → ${received.status}`);
    console.log(`  after: currentStock ${after.currentStock} | BR-001 ${mainQty} | BR-002 ${secondQty} (expect 98 / 80 / 18)`);

    const movements = await runWithOrg({ orgId }, async () =>
      StockMovement.find({ referenceId: transfer._id }).select('type quantity branchId').lean()
    );
    console.log(`✓ stock movements logged: ${movements.map((m: any) => `${m.type}:${m.quantity}`).join(', ')}`);

    // ── 4. Branch stats, availability and chain dashboard ───────────────────
    const stats = await api(`/branches/${secondId}/stats`, {}, token);
    console.log(`✓ BR-002 stats → stockValue ${stats.body?.data?.stockValue} | variants ${stats.body?.data?.variantCount} | lowStock ${stats.body?.data?.lowStockItems}`);

    const avail = await api(`/branches/product-availability/${productId}`, {}, token);
    const rows = avail.body?.data?.rows || [];
    console.log(`✓ availability → ${rows.map((r: any) => `${r.branchCode || 'unassigned'}:${r.quantity}`).join(', ')}`);

    const chain = await api('/branches/chain-dashboard?months=6', {}, token);
    const cd = chain.body?.data;
    console.log(`✓ chain dashboard → ${chain.status} | branches ${cd?.branches?.length} | monthly rows ${cd?.monthlySeries?.length} | pnl rows ${cd?.pnl?.length}`);
    console.log(`  consolidated: revenue ${cd?.totals?.revenue} | gross ${cd?.totals?.grossProfit} | net ${cd?.totals?.netProfit}`);

    // ── 5. Branch attribution on business records ───────────────────────────
    const me = await api('/auth/me', {}, token);
    const meData: any = me.body?.data?.user || me.body?.data || {};
    console.log(`✓ /auth/me branchId (HQ/super user → none expected): ${meData.branchId ?? 'undefined'}`);

    // Assign this user to BR-002 and confirm the next session picks it up
    console.log(`  ids → main ${mainId} | second ${secondId}`);
    const assign = await api(`/branches/${secondId}/assign-user`, { method: 'PUT', body: JSON.stringify({ userId: myUserId }) }, token);
    if (assign.status !== 200) console.log('  assign body:', JSON.stringify(assign.body).slice(0, 300));
    console.log(`✓ user assigned to BR-002 → ${assign.status}`);
    const relogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token2 = relogin.body?.data?.token;
    const me2 = await api('/auth/me', {}, token2);
    const me2Data: any = me2.body?.data?.user || me2.body?.data || {};
    console.log(`✓ after assignment, /auth/me branchId: ${me2Data.branchId} (expect ${secondId})`);

    // A sale from that branch user is stamped with the branch automatically
    const shift = await api('/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloat: 500, terminalId: 'QA-COUNTER-01' }),
    }, token2);
    if (shift.status !== 201 && shift.status !== 200) console.log('  shift body:', JSON.stringify(shift.body).slice(0, 200));
    console.log(`✓ shift opened at BR-002 → ${shift.status}`);

    const sale = await api('/sales/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-chain-${Date.now()}` },
      body: JSON.stringify({
        items: [{ variantId, quantity: 2, pricingTier: 'RETAIL' }],
        payments: [{ method: 'CASH', amount: 300 }],
        pricingTier: 'RETAIL',
        clientTimestamp: new Date().toISOString(),
      }),
    }, token2);
    if (sale.status !== 201 && sale.status !== 200) console.log('  sale body:', JSON.stringify(sale.body).slice(0, 300));
    console.log(`✓ checkout from the branch user → ${sale.status}`);

    const saleDoc: any = await runWithOrg({ orgId }, async () =>
      Sale.findOne({}).select('branchId invoiceNo orgId').lean()
    );
    console.log(`  sale.branchId stamped = ${saleDoc?.branchId ? String(saleDoc.branchId) === secondId : 'none'}`);
    console.log(`  debug → schema has branchId: ${!!Sale.schema.path('branchId')} | sale doc: ${JSON.stringify(saleDoc)}`);

    // Branch-restricted stock: BR-002 holds 18, so 50 must be refused
    const oversell = await api('/sales/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-chain-over-${Date.now()}` },
      body: JSON.stringify({
        items: [{ variantId, quantity: 50, pricingTier: 'RETAIL' }],
        payments: [{ method: 'CASH', amount: 7500 }],
        pricingTier: 'RETAIL',
        clientTimestamp: new Date().toISOString(),
      }),
    }, token2);
    console.log(`✓ selling 50 from a branch holding ~16 → ${oversell.status} ${oversell.body?.error?.code} (expect 422 INSUFFICIENT_INVENTORY)`);

    // ── 6. Guard rails ──────────────────────────────────────────────────────
    const del = await api(`/branches/${secondId}`, { method: 'DELETE' }, token);
    console.log(`✓ delete a branch in use → ${del.status} ${del.body?.error?.code} (expect 409 BRANCH_IN_USE)`);

    const notif = await api('/notifications?limit=5', {}, token);
    const notifRows = notif.body?.data?.data || notif.body?.data || [];
    const kinds = (Array.isArray(notifRows) ? notifRows : []).map((n: any) => n.type);
    console.log(`✓ transfer notifications in the bell: [${kinds.join(', ')}]`);

    // Branch list should now show today's takings for BR-002
    const listAfter = await api('/branches', {}, token);
    const branchRows: any[] = listAfter.body?.data || [];
    console.log(
      `✓ branch list today → ${branchRows.map((b: any) => `${b.code}: ৳${b.todaySales} (${b.todayInvoiceCount} inv)`).join(' | ')}`
    );

    // Chain dashboard after real activity
    const chainAfter = await api('/branches/chain-dashboard?months=6', {}, token);
    const ca = chainAfter.body?.data;
    console.log(
      `✓ chain dashboard after the sale → revenue ৳${ca?.totals?.revenue} | invoices ${ca?.totals?.invoices} | pnl: ${(ca?.pnl || [])
        .map((r: any) => `${r.code} rev ৳${r.revenue} net ৳${r.netProfit}`)
        .join(' | ')}`
    );
    const lastMonth = (ca?.monthlySeries || [])[(ca?.monthlySeries || []).length - 1] || {};
    console.log(`✓ latest month series → ${JSON.stringify(lastMonth)}`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        Sale.deleteMany({ orgId: oid }), Product.deleteMany({ orgId: oid }),
        StockMovement.deleteMany({ orgId: oid }), StockTransfer.deleteMany({ orgId: oid }),
        Branch.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Shift.deleteMany({ orgId: oid }), Expense.deleteMany({ orgId: oid }),
        PurchaseOrder.deleteMany({ orgId: oid }), Role.deleteMany({ orgId: oid }),
        Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }), User.deleteMany({ username: USERNAME }),
        Notification.deleteMany({ orgId: oid }),
        Organization.deleteOne({ _id: oid }),
      ]);
      console.log('✓ throwaway org removed');
    }
    await mongoose.disconnect();
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error('PROBE FAILED:', e?.message || e);
  process.exit(1);
});
