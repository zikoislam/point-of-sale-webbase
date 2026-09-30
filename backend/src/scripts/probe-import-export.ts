/** Module 6 — Import/Export (LC) + landed cost, verified in a throwaway org. */
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
import { StockMovement } from '../models/StockMovement';
import { Sale } from '../models/Sale';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { LetterOfCredit } from '../models/LetterOfCredit';
import { ProformaInvoice } from '../models/ProformaInvoice';
import { CommercialInvoice } from '../models/CommercialInvoice';
import { CnfAgent, CnfAgentLedger } from '../models/CnfAgent';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_lc_user';
const ORG_NAME = 'QA Import Export Org';

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

    await User.deleteMany({ username: USERNAME });
    await User.create({
      username: USERNAME, fullName: 'QA LC User', email: `${USERNAME}@example.com`, phone: '+8801788888888',
      passwordHash: 'Probe@123', pinHash: '8888', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error('login failed');
    console.log('✓ throwaway org + user ready');

    // ── Setup ───────────────────────────────────────────────────────────────
    const cat: any = await runWithOrg({ orgId }, async () =>
      Category.create({ name: 'QA LC Cat', code: `QALC${Date.now().toString(36).toUpperCase()}` })
    );

    const supplier = await api('/suppliers', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'Guangzhou Textile Co', contactPerson: 'Li Wei', phone: '+8613800000000', address: 'Guangzhou, China' }),
    }, token);
    const supplierId = id(supplier);
    if (!supplierId) throw new Error(`supplier failed: ${JSON.stringify(supplier.body).slice(0, 200)}`);
    console.log(`✓ foreign supplier → ${supplier.status}`);

    const productRes = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Imported Fabric', categoryId: String(cat._id), unit: 'Meter', taxType: 'INCLUSIVE', taxRate: 0,
        variants: [{
          attributeName: 'Roll', sku: `QA-LC-${Date.now().toString(36).toUpperCase()}`,
          costPrice: 100, retailSellingPrice: 400, wholesaleSellingPrice: 350, currentStock: 20, alertQty: 10,
        }],
      }),
    }, token);
    const productId = id(productRes);
    const variantId = productRes.body?.data?.variants?.[0]?._id;
    if (!variantId) throw new Error(`product failed: ${JSON.stringify(productRes.body).slice(0, 200)}`);
    console.log(`✓ product with 20 in stock at cost ৳100`);

    const agent = await api('/import-export/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chattogram C&F Services', agentType: 'CNF_AGENT', phone: '+8801799999999' }),
    }, token);
    const agentId = id(agent);
    console.log(`✓ C&F agent → ${agent.status}`);

    // ── 1. Letter of credit ─────────────────────────────────────────────────
    const lcRes = await api('/import-export/lc', {
      method: 'POST',
      body: JSON.stringify({
        issuingBank: 'Islami Bank Bangladesh', bankBranch: 'Agrabad', currency: 'USD', exchangeRate: 120,
        lcAmount: 10000, beneficiarySupplierId: supplierId, incoterms: 'CIF',
        portOfLoading: 'Shanghai', portOfDischarge: 'Chattogram',
        latestShipmentDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        expiryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        charges: [{ label: 'LC opening commission', amount: 3000 }, { label: 'Bank charges', amount: 2000 }],
      }),
    }, token);
    const lcId = id(lcRes);
    console.log(`1) LC created → ${lcRes.status} ${lcRes.body?.data?.lcNumber} | ${lcRes.body?.data?.currency} ${lcRes.body?.data?.lcAmount} = ৳${lcRes.body?.data?.lcAmountBdt} | charges ৳${lcRes.body?.data?.totalCharges} | status ${lcRes.body?.data?.status}`);

    // lifecycle
    for (const next of ['OPENED', 'SHIPPED', 'RECEIVED', 'RETIRED']) {
      const r = await api(`/import-export/lc/${lcId}/status`, { method: 'PUT', body: JSON.stringify({ status: next }) }, token);
      console.log(`   → ${next}: ${r.status} (status now ${r.body?.data?.status})`);
    }
    const badJump = await api(`/import-export/lc/${lcId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'OPENED' }) }, token);
    console.log(`   illegal move from RETIRED → ${badJump.status} ${badJump.body?.error?.code} (expect 409)`);
    const editRetired = await api(`/import-export/lc/${lcId}`, { method: 'PUT', body: JSON.stringify({ issuingBank: 'X' }) }, token);
    console.log(`   edit a retired LC → ${editRetired.status} ${editRetired.body?.error?.code} (expect 409)`);
    const doc = await api(`/import-export/lc/${lcId}/documents`, { method: 'PUT', body: JSON.stringify({ document: 'Bill of Lading' }) }, token);
    console.log(`   document checklist → ${doc.status} (${(doc.body?.data?.documentsReceived || []).length} recorded)`);

    // ── 2. Proforma invoice → link to a fresh LC ────────────────────────────
    const lc2 = await api('/import-export/lc', {
      method: 'POST',
      body: JSON.stringify({ issuingBank: 'City Bank', currency: 'USD', exchangeRate: 119.5, lcAmount: 20000, beneficiarySupplierId: supplierId }),
    }, token);
    const lc2Id = id(lc2);

    const piRes = await api('/import-export/pi', {
      method: 'POST',
      body: JSON.stringify({
        supplierId, supplierPiNo: 'GZ-PI-7781', currency: 'USD', exchangeRate: 120, incoterms: 'FOB',
        freightCost: 500, insuranceCost: 100,
        items: [
          { description: 'Cotton fabric 60s', quantity: 100, unit: 'Meter', unitPrice: 10 },
          { description: 'Polyester lining', quantity: 50, unit: 'Meter', unitPrice: 4 },
        ],
      }),
    }, token);
    const piId = id(piRes);
    console.log(`\n2) PI created → ${piRes.status} ${piRes.body?.data?.piNumber} | goods ${piRes.body?.data?.goodsValue} + freight 500 + insurance 100 = ${piRes.body?.data?.totalValue} USD = ৳${piRes.body?.data?.totalValueBdt}`);
    const link = await api(`/import-export/pi/${piId}/link-lc`, { method: 'PUT', body: JSON.stringify({ lcId: lc2Id }) }, token);
    console.log(`   linked to LC → ${link.status} | PI status now ${link.body?.data?.status} (expect LC_OPENED)`);

    // ── 3. Commercial invoice + landed cost ─────────────────────────────────
    const ciRes = await api('/import-export/ci', {
      method: 'POST',
      body: JSON.stringify({
        supplierId, lcId: lcId, piId: piId, supplierCiNo: 'GZ-CI-9911', currency: 'USD', exchangeRate: 120,
        allocationBasis: 'VALUE',
        items: [
          { description: 'Cotton fabric 60s', quantity: 100, unit: 'Meter', unitPrice: 10, productId, variantId },
          { description: 'Packaging material', quantity: 200, unit: 'Pcs', unitPrice: 1 },
        ],
        freightCostBdt: 20000, insuranceCostBdt: 4000, dutyAmountBdt: 30000, vatAmountBdt: 15000,
        otherChargesBdt: 5000, cnfChargesBdt: 10000,
        shipping: { blNumber: 'BL-778211', vesselName: 'MV Ocean Star', containerNo: 'MSKU1234567', arrivalDate: new Date().toISOString() },
      }),
    }, token);
    const ciId = id(ciRes);
    const ci = ciRes.body?.data;
    console.log(`\n3) CI created → ${ciRes.status} ${ci.ciNumber}`);
    console.log(`   goods ৳${ci.goodsValueBdt} | freight+ins ৳${ci.freightCostBdt + ci.insuranceCostBdt} | duty+vat ৳${ci.dutyAmountBdt + ci.vatAmountBdt} | other ৳${ci.otherChargesBdt} | LC charges ৳${ci.lcChargesBdt} | C&F ৳${ci.cnfChargesBdt}`);
    console.log(`   expected landed cost = ৳${120000 + 20000 + 4000 + 30000 + 15000 + 5000 + 5000 + 10000} (actual ৳${ci.landedCostBdt})`);

    const clear = await api(`/import-export/ci/${ciId}/clear`, {
      method: 'POST',
      body: JSON.stringify({ postStock: true, agentId, allocationBasis: 'VALUE' }),
    }, token);
    const cleared = clear.body?.data;
    console.log(`   cleared → ${clear.status} | landed ৳${cleared?.landedCost?.totalLandedCost} | per unit avg ৳${cleared?.landedCost?.perUnitAverage}`);
    for (const a of cleared?.appliedCosts || []) {
      console.log(`     • ${a.description}: qty ${a.quantity} → landed unit ৳${a.unitCost}`);
    }

    const after: any = await runWithOrg({ orgId }, async () => Product.findById(productId).lean());
    const v: any = after.variants[0];
    const expectedWac = Math.round(((20 * 100 + 100 * 2050) / 120) * 10000) / 10000;
    console.log(`   product now → stock ${v.currentStock} (expect 120) | cost ৳${v.costPrice} (expected WAC ৳${expectedWac})`);

    const movements: any[] = await runWithOrg({ orgId }, async () =>
      StockMovement.find({ referenceId: new mongoose.Types.ObjectId(ciId) }).select('type quantity unitCost referenceType stockBefore stockAfter').lean()
    );
    console.log(`   stock movements → ${movements.map((m) => `${m.type} ${m.quantity} @৳${m.unitCost} (${m.stockBefore}→${m.stockAfter}, ${m.referenceType})`).join(', ')}`);

    const again = await api(`/import-export/ci/${ciId}/clear`, { method: 'POST', body: JSON.stringify({ postStock: true }) }, token);
    console.log(`   applying twice → ${again.status} ${again.body?.error?.code} (expect 409)`);
    const illegalCi = await api(`/import-export/ci`, {
      method: 'POST',
      body: JSON.stringify({ supplierId, currency: 'USD', exchangeRate: 120, items: [] }),
    }, token);
    console.log(`   CI with no items → ${illegalCi.status} (expect 400)`);

    // ── 4. C&F agent ledger ─────────────────────────────────────────────────
    const ledger1 = await api(`/import-export/agents/${agentId}/ledger`, {}, token);
    console.log(`\n4) agent ledger after clearing → payable ৳${ledger1.body?.data?.summary?.outstanding} (expect 10000) | entries ${ledger1.body?.data?.summary?.entries}`);
    const pay = await api(`/import-export/agents/${agentId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ entryType: 'PAYMENT', amount: 4000, narration: 'Partial clearing payment' }),
    }, token);
    console.log(`   payment ৳4000 → ${pay.status} | balance now ৳${pay.body?.data?.balanceAfter}`);
    const overpay = await api(`/import-export/agents/${agentId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ entryType: 'PAYMENT', amount: 99999 }),
    }, token);
    console.log(`   overpayment → ${overpay.status} ${overpay.body?.error?.code} (expect 400)`);

    // ── 5. Reports ──────────────────────────────────────────────────────────
    const lcReport = await api('/reports/lc-status', {}, token);
    const s = lcReport.body?.data?.summary;
    console.log(`\n5) LC status report → open ${s?.openLcs} | exposure ৳${s?.totalExposureBdt} | charges ৳${s?.totalChargesBdt} | expiring soon ${s?.expiringSoon} | shipment deadline passed ${s?.shipmentDeadlinePassed} | not opened ${s?.notOpened}`);
    for (const r of lcReport.body?.data?.data || []) {
      console.log(`   ${r.lcNumber} [${r.status}] ৳${r.lcAmountBdt} outstanding ৳${r.outstandingBdt} | expiry in ${r.expiryDaysLeft}d | shipment in ${r.shipmentDaysLeft}d | alert ${r.alert || '—'}`);
    }
    console.log(`   by status: ${(s?.byStatus || []).map((b: any) => `${b.status}:${b.count}`).join(', ')}`);

    const landed = await api('/reports/landed-cost', {}, token);
    const ls = landed.body?.data?.summary;
    console.log(`\n   landed cost analysis → invoices ${ls?.invoices} | items ${ls?.items} | total landed ৳${ls?.totalLandedCost} | goods ৳${ls?.totalGoodsCost} | freight ৳${ls?.totalFreight} | duty ৳${ls?.totalDuty} | avg margin ${ls?.averageMarginPercent}%`);
    for (const r of landed.body?.data?.data || []) {
      console.log(`   ${r.productName} (${r.variantName || r.unit}) qty ${r.quantity} | landed/unit ৳${r.landedUnitCost} | selling ৳${r.sellingPrice} | margin ${r.marginPerUnit} (${r.marginPercent}%)`);
    }

    const agentPayables = await api('/reports/agent-payables', {}, token);
    console.log(`\n   agent payables → ${agentPayables.body?.data?.summary?.agents} agent(s) | total ৳${agentPayables.body?.data?.summary?.totalPayable}`);

    // The new stock must also show up in the inventory valuation report
    const valuation = await api('/reports/inventory-valuation', {}, token);
    const fabricRow = (valuation.body?.data?.data || []).find((r: any) => r.sku === v.sku);
    console.log(`\n   valuation now shows → stock ${fabricRow?.currentStock} @ cost ৳${fabricRow?.costPrice} = asset ৳${fabricRow?.assetValue}`);

    // ── 6. Exports ──────────────────────────────────────────────────────────
    for (const type of ['lc-status', 'landed-cost', 'agent-payables']) {
      const csv = await fetch(`${BASE}/reports/export/${type}`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await csv.text();
      console.log(`   export csv ${type.padEnd(16)} → ${csv.status} | ${text.split('\n').filter((l) => l.trim()).length - 1} data row(s)`);
    }
    const pdf = await fetch(`${BASE}/reports/export-pdf/landed-cost`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`   export pdf landed-cost → ${pdf.status} | ${(Buffer.from(await pdf.arrayBuffer()).length / 1024).toFixed(1)} KB`);
    const xlsx = await fetch(`${BASE}/reports/export-excel/lc-status`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`   export excel lc-status → ${xlsx.status} | ${(Buffer.from(await xlsx.arrayBuffer()).length / 1024).toFixed(1)} KB`);

    const notif = await api('/notifications?limit=5', {}, token);
    const kinds = (notif.body?.data?.data || notif.body?.data || []).map((n: any) => n.title);
    console.log(`\n   bell notifications: [${kinds.join(' | ')}]`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        LetterOfCredit.deleteMany({ orgId: oid }), ProformaInvoice.deleteMany({ orgId: oid }),
        CommercialInvoice.deleteMany({ orgId: oid }), CnfAgent.deleteMany({ orgId: oid }),
        CnfAgentLedger.deleteMany({ orgId: oid }),
        Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Supplier.deleteMany({ orgId: oid }), StockMovement.deleteMany({ orgId: oid }),
        Sale.deleteMany({ orgId: oid }), PurchaseOrder.deleteMany({ orgId: oid }),
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
