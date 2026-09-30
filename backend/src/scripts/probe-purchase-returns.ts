/**
 * End-to-end Purchase Return verification inside a THROWAWAY organization —
 * the real organization's books are never touched. Cleans up after itself.
 */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { ALL_PERMISSIONS } from '../config/permissions';
import { orgService } from '../services/OrgService';
import { runWithOrg } from '../middlewares/org.context';
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

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_pr_user';
const ORG_NAME = 'QA PR Org';

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
    // 0. throwaway organization + user
    await Organization.deleteMany({ name: ORG_NAME });
    const org: any = await orgService.createOrg({ name: ORG_NAME, adminPermissionSet: [...ALL_PERMISSIONS] });
    orgId = org.id;
    const adminRole: any = await Role.findOne({ orgId, name: 'ADMIN' }).lean();

    await User.deleteMany({ username: USERNAME });
    await User.create({
      username: USERNAME,
      fullName: 'QA PR User',
      email: `${USERNAME}@example.com`,
      phone: '+8801777777777',
      passwordHash: 'Probe@123',
      pinHash: '7777',
      roleId: adminRole._id,
      isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });
    console.log(`✓ throwaway org "${ORG_NAME}" created with its own books`);

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error(`login failed: ${JSON.stringify(login.body).slice(0, 200)}`);
    console.log(`✓ logged in (org: ${login.body?.data?.user?.orgName})`);

    // 1. category, product, supplier
    const cat: any = await runWithOrg({ orgId }, () => Category.create({ name: 'QA Cat', code: `QACAT${Date.now().toString(36).toUpperCase()}` }));
    const productRes = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Return Product',
        categoryId: String(cat._id),
        unit: 'Pcs',
        taxType: 'INCLUSIVE',
        taxRate: 0,
        variants: [{ attributeName: 'Std', sku: `QA-PR-${Date.now().toString(36).toUpperCase()}`, costPrice: 100, retailSellingPrice: 150, wholesaleSellingPrice: 140, currentStock: 0, alertQty: 5 }],
      }),
    }, token);
    const productId = productRes.body?.data?._id || productRes.body?.data?.id;
    const variant = productRes.body?.data?.variants?.[0];
    const variantId = variant?._id || variant?.id;
    if (!variantId) console.log('  product response:', JSON.stringify(productRes.body).slice(0, 500));
    console.log(`✓ product created (stock 0, sku ${variant?.sku})`);

    const supplierRes = await api('/suppliers', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'QA Return Supplier', contactPerson: 'QA', phone: '+8801666666666' }),
    }, token);
    const supplierId = supplierRes.body?.data?._id || supplierRes.body?.data?.id;
    console.log(`✓ supplier created`);

    // 2. PO + receive 20 units @ 100
    const poRes = await api('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplierId,
        items: [{ variantId, productName: 'QA Return Product', sku: variant?.sku || 'QA-SKU', orderedQty: 20, unitCost: 100 }],
      }),
    }, token);
    const poId = poRes.body?.data?._id || poRes.body?.data?.id;
    if (!poId) console.log('  PO response:', JSON.stringify(poRes.body).slice(0, 500));
    console.log(`✓ PO created (${poRes.body?.data?.poNumber}) status ${poRes.body?.data?.status}`);

    // DRAFT → ORDERED before receiving
    await api(`/purchase-orders/${poId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ORDERED' }) }, token);

    const grn = await api(`/purchase-orders/${poId}/grn`, {
      method: 'POST',
      body: JSON.stringify({ items: [{ variantId, receivedQty: 20, unitCost: 100 }] }),
    }, token);
    console.log(`✓ GRN received → ${grn.status}${grn.status !== 200 ? ` ${JSON.stringify(grn.body).slice(0, 160)}` : ''}`);

    const afterReceive = await runWithOrg({ orgId }, async () => ({
      stock: (await Product.findById(productId).lean() as any)?.variants?.[0]?.currentStock,
      payable: (await Supplier.findById(supplierId).lean() as any)?.currentPayableBalance,
    }));
    console.log(`  after GRN → stock ${afterReceive.stock}, supplier payable ${afterReceive.payable}`);

    // 3. purchase return: 5 units back @ 100
    const retRes = await api('/purchase-returns', {
      method: 'POST',
      body: JSON.stringify({
        purchaseOrderId: poId,
        refundMethod: 'ADJUSTED_AGAINST_PAYABLE',
        items: [{ variantId, quantity: 5, reason: 'Damaged', unitCost: 100 }],
      }),
    }, token);
    const ret: any = retRes.body?.data;
    console.log(`✓ POST /purchase-returns → ${retRes.status} | ${ret?.returnNumber} | total ${ret?.totalAmount} | effectsApplied ${ret?.effectsApplied}`);

    // 4. verify effects
    const after = await runWithOrg({ orgId }, async () => {
      const product = await Product.findById(productId).lean() as any;
      const supplier = await Supplier.findById(supplierId).lean() as any;
      const ledger = await SupplierLedger.find({ supplierId: new mongoose.Types.ObjectId(supplierId) }).lean();
      const journal = await JournalEntry.find({ source: 'PURCHASE_RETURN' }).lean();
      const movements = await StockMovement.find({ variantId: new mongoose.Types.ObjectId(variantId) }).lean();
      return {
        stock: product.variants[0].currentStock,
        payable: supplier.currentPayableBalance,
        ledgerTypes: ledger.map((l: any) => `${l.transactionType}(${l.amount})`),
        journalCount: journal.length,
        journalLines: (journal[0] as any)?.lines?.map((l: any) => `${l.accountName}: D${l.debit} C${l.credit}`),
        movementTypes: movements.map((m: any) => `${m.type}/${m.referenceType} ${m.quantity}`),
      };
    });

    console.log(`  after return → stock ${after.stock} (expect 15), payable ${after.payable} (expect 1500)`);
    console.log(`  supplier ledger: ${after.ledgerTypes.join(' | ')}`);
    console.log(`  journal entries: ${after.journalCount} | ${JSON.stringify(after.journalLines)}`);
    console.log(`  stock movements: ${after.movementTypes.join(' | ')}`);

    const ok = after.stock === 15 && after.payable === 1500 && after.journalCount >= 1;
    console.log(ok ? '✅ purchase return effects verified' : '❌ effects mismatch');
  } finally {
    // 5. wipe the throwaway org and everything in it
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        Product.deleteMany({ orgId: oid }),
        Supplier.deleteMany({ orgId: oid }),
        PurchaseOrder.deleteMany({ orgId: oid }),
        PurchaseReturn.deleteMany({ orgId: oid }),
        SupplierLedger.deleteMany({ orgId: oid }),
        JournalEntry.deleteMany({ orgId: oid }),
        StockMovement.deleteMany({ orgId: oid }),
        Category.deleteMany({ orgId: oid }),
        Account.deleteMany({ orgId: oid }),
        Settings.deleteMany({ orgId: oid }),
        ExpenseCategory.deleteMany({ orgId: oid }),
        Role.deleteMany({ orgId: oid }),
        Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }),
        User.deleteMany({ username: USERNAME }),
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
