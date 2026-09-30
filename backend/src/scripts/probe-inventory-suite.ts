/** Phase 8 — Inventory Suite + sales register reports, verified in a throwaway org. */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Supplier } from '../models/Supplier';
import { Customer } from '../models/Customer';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { StockMovement } from '../models/StockMovement';
import { SalesReturn } from '../models/SalesReturn';
import { Shift } from '../models/Shift';
import { Branch } from '../models/Branch';
import { StockTransfer } from '../models/StockTransfer';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { CustomerLedger } from '../models/CustomerLedger';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_suite_user';
const ORG_NAME = 'QA Inventory Suite Org';

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

const q = (d: any) => (d === null || d === undefined ? '—' : d);

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
      username: USERNAME, fullName: 'QA Suite User', email: `${USERNAME}@example.com`, phone: '+8801777777777',
      passwordHash: 'Probe@123', pinHash: '7777', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error('login failed');
    console.log('✓ throwaway org + user ready');

    // ── Setup: category, two suppliers, product with batches ────────────────
    const cat: any = await runWithOrg({ orgId }, async () =>
      Category.create({ name: 'QA Suite Cat', code: `QAS${Date.now().toString(36).toUpperCase()}` })
    );
    const catId = String(cat._id);

    const supA = await api('/suppliers', { method: 'POST', body: JSON.stringify({ companyName: 'Alpha Traders', contactPerson: 'Alpha Manager', phone: '+8801711111111' }) }, token);
    const supB = await api('/suppliers', { method: 'POST', body: JSON.stringify({ companyName: 'Beta Supplies', contactPerson: 'Beta Manager', phone: '+8801722222222' }) }, token);
    const supAId = supA.body?.data?._id || supA.body?.data?.id;
    const supBId = supB.body?.data?._id || supB.body?.data?.id;
    if (!supAId || !supBId) console.log('  supplier body:', JSON.stringify(supA.body).slice(0, 250), JSON.stringify(supB.body).slice(0, 250));
    console.log(`✓ suppliers → Alpha ${supA.status} | Beta ${supB.status}`);

    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const productRes = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Suite Product', categoryId: catId, unit: 'Pcs', taxType: 'INCLUSIVE', taxRate: 0,
        variants: [
          {
            attributeName: 'Small', sku: `QA-SUITE-S-${Date.now().toString(36).toUpperCase()}`,
            costPrice: 100, retailSellingPrice: 160, wholesaleSellingPrice: 135, currentStock: 100, alertQty: 10,
            batches: [
              { batchNo: 'B-SOON', costPrice: 100, expiryDate: new Date(soon), quantity: 20, receivedAt: new Date() },
              { batchNo: 'B-PAST', costPrice: 95, expiryDate: new Date(past), quantity: 8, receivedAt: new Date() },
            ],
          },
          {
            attributeName: 'Large', sku: `QA-SUITE-L-${Date.now().toString(36).toUpperCase()}`,
            costPrice: 150, retailSellingPrice: 240, wholesaleSellingPrice: 200, currentStock: 4, alertQty: 5,
          },
        ],
      }),
    }, token);
    const productId = productRes.body?.data?._id || productRes.body?.data?.id;
    const smallVariant = productRes.body?.data?.variants?.[0];
    const largeVariant = productRes.body?.data?.variants?.[1];
    if (!smallVariant || !largeVariant) throw new Error(`product create failed: ${JSON.stringify(productRes.body).slice(0, 300)}`);
    console.log(`✓ product with 2 variants (one has expiring + expired batches)`);

    // ── POs from two suppliers at different prices (same variant) ───────────
    const mkPo = async (supplierId: string, unitCost: number, qty: number) =>
      api('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          items: [{ variantId: smallVariant._id, productName: 'QA Suite Product', sku: smallVariant.sku, orderedQty: qty, unitCost }],
        }),
      }, token);

    const poA = await mkPo(supAId, 95, 50);
    const poB = await mkPo(supBId, 92, 40);
    const poAId = poA.body?.data?._id || poA.body?.data?.id;
    console.log(`✓ purchase orders → Alpha @95 (${poA.status}) | Beta @92 (${poB.status})`);

    // Receive Alpha's PO so movements + WAC exist
    const grn = await api(`/purchase-orders/${poAId}/receive`, {
      method: 'POST',
      body: JSON.stringify({
        items: [{ variantId: smallVariant._id, receivedQty: 50, unitCost: 95 }],
        paidAmount: 0,
      }),
    }, token);
    console.log(`✓ GRN received → ${grn.status} (stock movements + cost update)`);

    // ── Customers + a shift, then retail & wholesale sales ──────────────────
    const retailCust = await api('/customers', { method: 'POST', body: JSON.stringify({ name: 'Walk-in QA', phone: '+8801733333333', customerType: 'RETAIL' }) }, token);
    const wholeCust = await api('/customers', { method: 'POST', body: JSON.stringify({ name: 'Bulk Buyer QA', phone: '+8801744444444', customerType: 'WHOLESALE', creditLimit: 50000 }) }, token);
    const wholeId = wholeCust.body?.data?._id || wholeCust.body?.data?.id;
    console.log(`✓ customers → retail ${retailCust.status} | wholesale ${wholeCust.status}`);

    const shift = await api('/shifts/open', { method: 'POST', body: JSON.stringify({ openingFloat: 1000, terminalId: 'QA-SUITE-01' }) }, token);
    console.log(`✓ shift opened → ${shift.status}`);

    const checkout = async (tier: 'RETAIL' | 'WHOLESALE', qty: number, amount: number, customerId?: string) =>
      api('/sales/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': `qa-suite-${tier}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
        body: JSON.stringify({
          customerId,
          pricingTier: tier,
          items: [{ variantId: smallVariant._id, quantity: qty, pricingTier: tier }],
          payments: [{ method: 'CASH', amount }],
          clientTimestamp: new Date().toISOString(),
        }),
      }, token);

    const retailSale = await checkout('RETAIL', 2, 320);
    const wholesaleSale = await checkout('WHOLESALE', 10, 1350, wholeId);
    console.log(`✓ sales → retail ${retailSale.status} | wholesale ${wholesaleSale.status}`);
    if (wholesaleSale.status !== 201) console.log('  wholesale body:', JSON.stringify(wholesaleSale.body).slice(0, 250));

    // Sell the low-stock variant out completely so auto-reorder has a candidate
    const largeSale = await api('/sales/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-suite-large-${Date.now()}` },
      body: JSON.stringify({
        pricingTier: 'RETAIL',
        items: [{ variantId: largeVariant._id, quantity: 4, pricingTier: 'RETAIL' }],
        payments: [{ method: 'CARD', amount: 960 }],
        clientTimestamp: new Date().toISOString(),
      }),
    }, token);
    console.log(`✓ sold the last 4 of the low-stock variant → ${largeSale.status}`);

    // ── REPORT 1: valuation ────────────────────────────────────────────────
    const valuation = await api('/reports/inventory-valuation', {}, token);
    console.log(`\n1) valuation → ${valuation.status} | variants ${valuation.body?.data?.summary?.totalVariants} | qty ${valuation.body?.data?.summary?.totalStockQty} | asset ${valuation.body?.data?.summary?.totalValuation}`);

    // ── REPORT 2: stock ledger (per variant) ───────────────────────────────
    const ledger = await api(`/reports/stock-ledger?productId=${productId}&variantId=${smallVariant._id}`, {}, token);
    const ls = ledger.body?.data?.summary;
    console.log(`2) stock ledger → ${ledger.status} | movements ${ls?.movements} | in ${ls?.totalIn} | out ${ls?.totalOut} | closing ${ls?.closingBalance}`);
    console.log(`   last rows: ${(ledger.body?.data?.data || []).slice(-3).map((r: any) => `${r.type}/${r.referenceType} ${r.quantity} → bal ${r.balance}`).join(' | ')}`);
    const noProduct = await api('/reports/stock-ledger', {}, token);
    console.log(`   without a product → ${noProduct.status} ${noProduct.body?.error?.code} (expect 400)`);

    // ── REPORT 3: movement summary ─────────────────────────────────────────
    const mov = await api('/reports/stock-movement-summary', {}, token);
    console.log(`3) movement summary → ${mov.status} | events ${mov.body?.data?.summary?.totalEvents} | in ${mov.body?.data?.summary?.totalInQty} | out ${mov.body?.data?.summary?.totalOutQty} | value ${mov.body?.data?.summary?.totalStockValue}`);
    console.log(`   by type: ${(mov.body?.data?.byType || []).map((r: any) => `${r.type}/${r.referenceType}:${r.quantity}`).join(', ')}`);
    console.log(`   top mover: ${mov.body?.data?.topMovers?.[0]?.productName} (out ${mov.body?.data?.topMovers?.[0]?.outQty})`);

    // ── REPORT 4: expiry ───────────────────────────────────────────────────
    const expiry = await api('/reports/expiry?days=30', {}, token);
    console.log(`4) expiry → ${expiry.status} | expired ${expiry.body?.data?.summary?.expiredBatches} (value ${expiry.body?.data?.summary?.expiredValue}) | soon ${expiry.body?.data?.summary?.expiringBatches} (at risk ${expiry.body?.data?.summary?.atRiskValue})`);
    console.log(`   batches: ${(expiry.body?.data?.data || []).map((r: any) => `${r.batchNo}:${r.status}:${r.daysLeft}d`).join(', ')}`);

    // ── REPORT 5: supplier price comparison ────────────────────────────────
    const prices = await api('/reports/supplier-price-comparison', {}, token);
    const firstProduct = prices.body?.data?.data?.[0];
    console.log(`5) supplier prices → ${prices.status} | products ${prices.body?.data?.summary?.products} | multi-supplier ${prices.body?.data?.summary?.multiSupplierProducts} | avg spread ${prices.body?.data?.summary?.avgSpreadPercent}%`);
    console.log(`   ${firstProduct?.productName}: cheapest ${firstProduct?.cheapestPrice} (${firstProduct?.bestSupplier}) vs dearest ${firstProduct?.dearestPrice} | suppliers ${firstProduct?.supplierCount}`);

    // ── REPORT 6: purchase vs sales turnover ───────────────────────────────
    const pvs = await api('/reports/purchase-vs-sales', {}, token);
    console.log(`6) purchase vs sales → ${pvs.status} | sales ${pvs.body?.data?.summary?.totalSales} | purchases ${pvs.body?.data?.summary?.totalPurchases} | cogs ${pvs.body?.data?.summary?.cogs} | stock ${pvs.body?.data?.summary?.stockValue} | turnover ${pvs.body?.data?.summary?.turnoverRatio}`);
    console.log(`   months: ${(pvs.body?.data?.data || []).map((r: any) => `${r.month} sales ${r.salesValue} / purch ${r.purchaseValue}`).join(' | ')}`);

    // ── REPORT 7: auto reorder by velocity ─────────────────────────────────
    const reorder = await api('/reports/auto-reorder', {}, token);
    console.log(`7) auto reorder → ${reorder.status} | items ${reorder.body?.data?.summary?.items} | critical ${reorder.body?.data?.summary?.critical} | est cost ${reorder.body?.data?.summary?.totalEstimatedCost}`);
    for (const r of (reorder.body?.data?.data || []).slice(0, 3)) {
      console.log(`   ${r.productName} ${r.variantName}: stock ${r.currentStock} | daily ${r.avgDailySales} | days left ${r.daysLeft} | suggest ${r.suggestedQty} | ${r.priority}`);
    }

    // ── REPORT 8: daily register ───────────────────────────────────────────
    const register = await api('/reports/daily-register', {}, token);
    const day = register.body?.data?.data?.[0];
    console.log(`\n8) daily register → ${register.status} | days ${register.body?.data?.summary?.days} | invoices ${register.body?.data?.summary?.invoices} | net ${register.body?.data?.summary?.net}`);
    console.log(`   latest day: ${day?.date} gross ${day?.gross} discount ${day?.discount} net ${day?.net} cash ${day?.cash} due ${day?.dues} avg ${day?.averageBill}`);

    // ── REPORT 9: wholesale vs retail ──────────────────────────────────────
    const wvr = await api('/reports/wholesale-vs-retail', {}, token);
    console.log(`9) wholesale vs retail → ${wvr.status} | total ${wvr.body?.data?.summary?.totalRevenue}`);
    for (const r of wvr.body?.data?.data || []) {
      console.log(`   ${r.channel}: ${r.invoices} invoice(s) | revenue ${r.revenue} | avg bill ${r.averageBill} | share ${r.revenueShare}%`);
    }

    // ── REPORT 10: top selling products ────────────────────────────────────
    const top = await api('/reports/top-products?limit=5', {}, token);
    console.log(`10) top products → ${top.status} | products ${top.body?.data?.summary?.products} | qty ${top.body?.data?.summary?.totalQuantity} | revenue ${top.body?.data?.summary?.totalRevenue}`);
    for (const r of top.body?.data?.data || []) {
      console.log(`   #${r.rank} ${r.productName} (${r.sku}) qty ${r.quantity} revenue ${r.revenue} share ${r.revenueShare}%`);
    }

    // ── Exports ────────────────────────────────────────────────────────────
    for (const type of ['stock-ledger', 'expiry', 'auto-reorder', 'daily-register', 'top-products', 'supplier-price-comparison', 'purchase-vs-sales', 'wholesale-vs-retail', 'stock-movement-summary']) {
      const qs = type === 'stock-ledger' ? `?productId=${productId}&variantId=${smallVariant._id}` : '';
      const csv = await fetch(`${BASE}/reports/export/${type}${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await csv.text();
      const rows = text.split('\n').filter((l) => l.trim().length > 0).length - 1;
      console.log(`   export csv ${type.padEnd(26)} → ${csv.status} | ${rows} data row(s)`);
    }
    const pdf = await fetch(`${BASE}/reports/export-pdf/daily-register`, { headers: { Authorization: `Bearer ${token}` } });
    const pdfBuf = Buffer.from(await pdf.arrayBuffer());
    console.log(`   export pdf daily-register → ${pdf.status} | ${(pdfBuf.length / 1024).toFixed(1)} KB`);
    const xlsx = await fetch(`${BASE}/reports/export-excel/auto-reorder`, { headers: { Authorization: `Bearer ${token}` } });
    const xlsxBuf = Buffer.from(await xlsx.arrayBuffer());
    console.log(`   export excel auto-reorder → ${xlsx.status} | ${(xlsxBuf.length / 1024).toFixed(1)} KB`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        Sale.deleteMany({ orgId: oid }), SalesReturn.deleteMany({ orgId: oid }),
        Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Supplier.deleteMany({ orgId: oid }), Customer.deleteMany({ orgId: oid }),
        PurchaseOrder.deleteMany({ orgId: oid }), StockMovement.deleteMany({ orgId: oid }),
        Shift.deleteMany({ orgId: oid }), Branch.deleteMany({ orgId: oid }),
        StockTransfer.deleteMany({ orgId: oid }), CustomerLedger.deleteMany({ orgId: oid }),
        Role.deleteMany({ orgId: oid }), Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }),
        User.deleteMany({ username: USERNAME }), Notification.deleteMany({ orgId: oid }),
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
