/** Phase 11.2 + 12.2 — scheduled reports, caching, compression, rate limits. */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Sale } from '../models/Sale';
import { Customer } from '../models/Customer';
import { Shift } from '../models/Shift';
import { Settings } from '../models/Settings';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { ScheduledReport } from '../models/ScheduledReport';
import { StockMovement } from '../models/StockMovement';
import { Account } from '../models/Account';
import { JournalEntry } from '../models/JournalEntry';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_perf_user';
const ORG_NAME = 'QA Perf Org';

async function raw(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  return res;
}

async function api(path: string, init: RequestInit = {}, token?: string) {
  const res = await raw(path, init, token);
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) };
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

    await User.deleteMany({ username: USERNAME });
    await User.create({
      username: USERNAME, fullName: 'QA Perf User', email: `${USERNAME}@example.com`, phone: '+8801790000000',
      passwordHash: 'Probe@123', pinHash: '9999', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error('login failed');
    console.log('✓ throwaway org + user ready');

    // ── Some data so the reports have something to chew on ──────────────────
    const cat: any = await runWithOrg({ orgId }, async () =>
      Category.create({ name: 'QA Perf Cat', code: `QAP${Date.now().toString(36).toUpperCase()}` })
    );
    await api('/settings', { method: 'PUT', body: JSON.stringify({ poApprovalThreshold: 0 }) }, token);
    const supplier = await api('/suppliers', { method: 'POST', body: JSON.stringify({ companyName: 'Perf Supplier', contactPerson: 'Perf Manager', phone: '+8801711111111' }) }, token);
    const supplierId = id(supplier);
    const customer = await api('/customers', { method: 'POST', body: JSON.stringify({ name: 'Perf Customer', phone: '+8801755555555' }) }, token);
    const customerId = id(customer);

    const variantIds: string[] = [];
    // Inserted directly for speed — the API would need one call per product and
    // this probe only needs a payload big enough to exercise gzip.
    const stamp = Date.now().toString(36).toUpperCase();
    const bulk: any[] = [];
    for (let i = 0; i < 60; i++) {
      bulk.push({
        name: `Perf Product ${i + 1}`,
        categoryId: cat._id,
        unit: 'Pcs',
        taxType: 'INCLUSIVE',
        taxRate: 0,
        isActive: true,
        variants: [{
          attributeName: 'Std',
          sku: `QA-PERF-${i + 1}-${stamp}`,
          // unique barcode: the org+barcode index is unique, and nulls collide
          barcode: `QA-BC-${i + 1}-${stamp}`,
          costPrice: 100 + i,
          retailSellingPrice: 200 + i,
          wholesaleSellingPrice: 180 + i,
          currentStock: 500,
          alertQty: 5,
          isAvailable: true,
        }],
      });
    }
    const inserted: any[] = await runWithOrg({ orgId }, async () => Product.insertMany(bulk));
    for (const p of inserted) variantIds.push(String(p.variants[0]._id));
    console.log(`✓ 60 products seeded directly (for a >1KB report payload)`);

    const shift = await api('/shifts/open', { method: 'POST', body: JSON.stringify({ openingFloat: 1000, terminalId: 'QA-PERF-01' }) }, token);
    const sale = await api('/sales/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-perf-${Date.now()}` },
      body: JSON.stringify({
        customerId, pricingTier: 'RETAIL',
        items: variantIds.slice(0, 5).map((v) => ({ variantId: v, quantity: 2, pricingTier: 'RETAIL' })),
        payments: [{ method: 'CASH', amount: 2200 }],
        clientTimestamp: new Date().toISOString(),
      }),
    }, token);
    console.log(`✓ shift ${shift.status} | sale ${sale.status}${sale.status !== 201 ? ` → ${sale.body?.error?.code}: ${JSON.stringify(sale.body?.error?.details || sale.body?.error?.message).slice(0, 300)}` : ''}`);

    // ══════════════ 12.2 — report cache ══════════════
    console.log('\n── Report cache ──');
    const first = await api('/reports/inventory-valuation', {}, token);
    const second = await api('/reports/inventory-valuation', {}, token);
    const third = await api('/reports/inventory-valuation?noCache=1', {}, token);
    console.log(`1st call → ${first.status} X-Cache: ${first.headers.get('x-cache')}`);
    console.log(`2nd call → ${second.status} X-Cache: ${second.headers.get('x-cache')} (expect HIT) | payload identical: ${JSON.stringify(first.body) === JSON.stringify(second.body)}`);
    console.log(`bypass (?noCache=1) → ${third.status} X-Cache: ${third.headers.get('x-cache')} (expect MISS)`);

    // A write must invalidate the cache for this organization
    await api('/customers', { method: 'POST', body: JSON.stringify({ name: 'Cache Buster', phone: '+8801766666666' }) }, token);
    const afterWrite = await api('/reports/inventory-valuation', {}, token);
    console.log(`after a write → X-Cache: ${afterWrite.headers.get('x-cache')} (expect MISS — cache invalidated)`);

    // ══════════════ 12.2 — gzip compression ══════════════
    console.log('\n── Compression ──');
    const plainRes = await fetch(`${BASE}/reports/inventory-valuation`, {
      headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache' },
    });
    const plainBody = await plainRes.text();
    const gzRes = await raw('/reports/inventory-valuation?noCache=1', { headers: { 'Accept-Encoding': 'gzip' } }, token);
    const gzBuf = Buffer.from(await gzRes.arrayBuffer());
    const gzText = (() => {
      try {
        return require('zlib').gunzipSync(gzBuf).toString('utf8');
      } catch {
        return '';
      }
    })();
    console.log(`without gzip → ${plainRes.status} | ${(Buffer.byteLength(plainBody) / 1024).toFixed(1)} KB | encoding: ${plainRes.headers.get('content-encoding') || 'none'}`);
    console.log(`with gzip    → ${gzRes.status} | ${(gzBuf.length / 1024).toFixed(1)} KB | encoding: ${gzRes.headers.get('content-encoding') || 'none'} (expect gzip)`);
    if (gzText) {
      console.log(`saved ${(100 - (gzBuf.length / Buffer.byteLength(plainBody)) * 100).toFixed(1)}% | decompresses to valid JSON: ${gzText.trim().startsWith('{')}`);
    }

    // ══════════════ 11.2 — scheduled reports ══════════════
    console.log('\n── Scheduled reports ──');
    const options = await api('/scheduled-reports/options', {}, token);
    console.log(`catalogue → ${options.body?.data?.reportTypes?.length} report type(s) | email configured: ${options.body?.data?.emailConfigured}`);
    const invalidTime = await api('/scheduled-reports', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad time', reportType: 'sales', frequency: 'DAILY', timeOfDay: '25:99', recipients: ['owner@shop.com'] }),
    }, token);
    console.log(`invalid time → ${invalidTime.status} ${invalidTime.body?.error?.code} (expect 400)`);
    const invalidTo = await api('/scheduled-reports', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad recipients', reportType: 'sales', frequency: 'DAILY', timeOfDay: '08:00', recipients: ['not-an-email'] }),
    }, token);
    console.log(`invalid recipients → ${invalidTo.status} ${invalidTo.body?.error?.code} (expect 400)`);
    const weeklyNoDay = await api('/scheduled-reports', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad weekly', reportType: 'sales', frequency: 'WEEKLY', timeOfDay: '08:00', recipients: ['owner@shop.com'] }),
    }, token);
    console.log(`weekly without a day → ${weeklyNoDay.status} ${weeklyNoDay.body?.error?.code} (expect 400)`);

    const daily = await api('/scheduled-reports', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Daily sales to the owner', reportType: 'daily-register', frequency: 'DAILY',
        timeOfDay: '21:30', periodDays: 1, recipients: ['owner@shop.com', 'accounts@shop.com'], format: 'PDF',
      }),
    }, token);
    const dailyId = id(daily);
    console.log(`daily schedule → ${daily.status} | next run ${new Date(daily.body?.data?.nextRunAt).toLocaleString()}`);

    const weekly = await api('/scheduled-reports', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weekly inventory', reportType: 'inventory', frequency: 'WEEKLY', dayOfWeek: 1,
        timeOfDay: '09:00', periodDays: 7, recipients: ['owner@shop.com'], format: 'EXCEL',
      }),
    }, token);
    const monthly = await api('/scheduled-reports', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Monthly P&L', reportType: 'pnl', frequency: 'MONTHLY', dayOfMonth: 3,
        timeOfDay: '10:15', periodDays: 30, recipients: ['owner@shop.com'], format: 'PDF',
      }),
    }, token);
    const now = Date.now();
    for (const [label, res] of [['weekly', weekly], ['monthly', monthly]] as const) {
      const next = new Date(res.body?.data?.nextRunAt);
      const days = Math.round((next.getTime() - now) / 86400000);
      console.log(`${label} schedule → next ${next.toLocaleString()} (in ${days}d, weekday ${next.getDay()}, day-of-month ${next.getDate()})`);
    }

    // Run one on demand — email is not configured in this environment
    const runNow = await api(`/scheduled-reports/${dailyId}/run`, { method: 'POST' }, token);
    const run = runNow.body?.data;
    console.log(`\nrun now → ${runNow.status} | status ${run?.status} | attachment ${run?.attachment} | ${run?.durationMs}ms`);
    console.log(`  message: ${runNow.body?.message}`);

    const afterRun = await api(`/scheduled-reports/${dailyId}`, {}, token);
    console.log(`history → ${afterRun.body?.data?.history?.length} entry | lastRunStatus ${afterRun.body?.data?.lastRunStatus} | next run moved to ${new Date(afterRun.body?.data?.nextRunAt).toLocaleString()}`);

    const pause = await api(`/scheduled-reports/${dailyId}/toggle`, { method: 'PUT' }, token);
    console.log(`pause → isActive ${pause.body?.data?.isActive} | next run ${pause.body?.data?.nextRunAt}`);
    const resume = await api(`/scheduled-reports/${dailyId}/toggle`, { method: 'PUT' }, token);
    console.log(`resume → isActive ${resume.body?.data?.isActive} | next run ${new Date(resume.body?.data?.nextRunAt).toLocaleString()}`);

    const due = await api('/scheduled-reports/run-due', { method: 'POST' }, token);
    console.log(`cron tick (run-due) → ${due.status} | processed ${due.body?.data?.ran} | results: ${(due.body?.data?.results || []).map((r: any) => `${r.name}=${r.status}`).join(', ') || 'none due'}`);

    // ══════════════ 12.2 — performance profile & rate limits ══════════════
    console.log('\n── Performance profile ──');
    const perf = await api('/system/performance', {}, token);
    const p = perf.body?.data;
    console.log(`totals → ${p?.totals?.requests} request(s) across ${p?.totals?.endpoints} endpoint(s) | slow ${p?.totals?.slow} (${p?.totals?.slowSharePercent}%) | threshold ${p?.slowThresholdMs}ms`);
    for (const e of (p?.endpoints || []).slice(0, 5)) {
      console.log(`  ${e.endpoint} → ${e.requests} req | avg ${e.avgMs}ms | max ${e.maxMs}ms`);
    }
    const cacheStats = await api('/system/cache', {}, token);
    console.log(`cache → ${cacheStats.body?.data?.entries} entries | hits ${cacheStats.body?.data?.hits} | misses ${cacheStats.body?.data?.misses} | hit rate ${cacheStats.body?.data?.hitRatePercent}%`);

    console.log('\n── Rate limits ──');
    // Reports: 30/min per user. Already used a few, so count the 429s.
    let limited = 0;
    let firstLimitAt = 0;
    for (let i = 1; i <= 40; i++) {
      const r = await api('/reports/sales', {}, token);
      if (r.status === 429) {
        limited += 1;
        if (!firstLimitAt) firstLimitAt = i;
      }
    }
    console.log(`report calls → first 429 on call #${firstLimitAt} | ${limited}/40 were rate limited (limit 30/min)`);
    const limitedBody = await api('/reports/sales', {}, token);
    console.log(`  429 body → ${limitedBody.body?.error?.code} | "${limitedBody.body?.error?.message}"`);

    // Exports: 10/min — the strictest
    let exportLimited = 0;
    for (let i = 1; i <= 14; i++) {
      const r = await raw('/reports/export/csv/purchases', {}, token);
      if (r.status === 429) exportLimited += 1;
    }
    console.log(`export calls → ${exportLimited}/14 were rate limited (limit 10/min)`);

    // POS stays generous
    let posLimited = 0;
    for (let i = 1; i <= 25; i++) {
      const r = await api('/sales?limit=1', {}, token);
      if (r.status === 429) posLimited += 1;
    }
    console.log(`POS calls → ${posLimited}/25 rate limited (limit 200/min — should stay 0)`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        ScheduledReport.deleteMany({ orgId: oid }),
        Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Sale.deleteMany({ orgId: oid }), Customer.deleteMany({ orgId: oid }),
        Shift.deleteMany({ orgId: oid }), StockMovement.deleteMany({ orgId: oid }),
        Account.deleteMany({ orgId: oid }), JournalEntry.deleteMany({ orgId: oid }),
        Settings.deleteMany({ orgId: oid }), Role.deleteMany({ orgId: oid }),
        Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }), User.deleteMany({ username: USERNAME }),
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
