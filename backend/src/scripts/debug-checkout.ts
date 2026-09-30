/** Debug: reproduce the checkout 500 in-process so the stack trace surfaces. */
import mongoose from 'mongoose';

import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Customer } from '../models/Customer';
import { Sale } from '../models/Sale';
import { Shift } from '../models/Shift';
import { StockMovement } from '../models/StockMovement';
import { Settings } from '../models/Settings';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { Account } from '../models/Account';
import { JournalEntry } from '../models/JournalEntry';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';
import { saleService } from '../services/SaleService';

const ORG_NAME = 'QA Checkout Debug Org';

async function run() {
  await connectDB();
  let orgId = '';

  try {
    await Organization.deleteMany({ name: ORG_NAME });
    const org: any = await orgService.createOrg({ name: ORG_NAME, adminPermissionSet: [...ALL_PERMISSIONS] });
    orgId = org.id;
    const adminRole: any = await Role.findOne({ orgId, name: 'ADMIN' }).lean();

    const user: any = await User.create({
      username: 'qa_checkout_user', fullName: 'QA Checkout', email: 'qa_checkout@example.com', phone: '+8801791111111',
      passwordHash: 'Probe@123', pinHash: '1212', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });
    const cashierId = String(user._id);

    await runWithOrg({ orgId }, async () => {
      const cat: any = await Category.create({ name: 'QA Checkout Cat', code: `QAC${Date.now().toString(36).toUpperCase()}` });
      const stamp = Date.now().toString(36).toUpperCase();

      // Same shape as the perf probe: 60 bulk products, one variant each
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
      const products: any[] = await Product.insertMany(bulk);
      const variantIds = products.slice(0, 5).map((p) => String(p.variants[0]._id));

      const customer: any = await Customer.create({ name: 'Perf Customer', phone: '+8801755555555' });
      await Shift.create({ userId: user._id, terminalId: 'QA-DEBUG-01', openingFloat: 1000, status: 'OPEN', openedAt: new Date() });

      console.log('attempting checkout with 5 items…');
      try {
        const sale: any = await saleService.checkout(
          {
            customerId: String(customer._id),
            pricingTier: 'RETAIL',
            items: variantIds.map((v) => ({ variantId: v, quantity: 2, pricingTier: 'RETAIL' as const })),
            payments: [{ method: 'CASH' as const, amount: 2200 }],
            idempotencyKey: `qa-debug-${Date.now()}`,
          } as any,
          cashierId
        );
        console.log('✓ checkout succeeded:', sale.invoiceNo, 'total', sale.totalAmount);
      } catch (err: any) {
        console.log('✗ checkout threw:', err?.code || err?.name, '|', err?.message);
        console.log(err?.stack?.split('\n').slice(0, 14).join('\n'));
      }

      // Narrow it down: one item at a time
      console.log('\nretrying with a single item…');
      try {
        const sale: any = await saleService.checkout(
          {
            customerId: String(customer._id),
            pricingTier: 'RETAIL',
            items: [{ variantId: variantIds[0], quantity: 2, pricingTier: 'RETAIL' as const }],
            payments: [{ method: 'CASH' as const, amount: 400 }],
            idempotencyKey: `qa-debug-single-${Date.now()}`,
          } as any,
          cashierId
        );
        console.log('✓ single-item checkout succeeded:', sale.invoiceNo, 'total', sale.totalAmount);
      } catch (err: any) {
        console.log('✗ single-item checkout threw:', err?.code || err?.name, '|', err?.message);
        console.log(err?.stack?.split('\n').slice(0, 14).join('\n'));
      }
    });
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        Sale.deleteMany({ orgId: oid }), Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Customer.deleteMany({ orgId: oid }), Shift.deleteMany({ orgId: oid }), StockMovement.deleteMany({ orgId: oid }),
        Account.deleteMany({ orgId: oid }), JournalEntry.deleteMany({ orgId: oid }), Settings.deleteMany({ orgId: oid }),
        Role.deleteMany({ orgId: oid }), Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }),
        User.deleteMany({ username: 'qa_checkout_user' }), Notification.deleteMany({ orgId: oid }),
        Organization.deleteOne({ _id: oid }),
      ]);
      console.log('\n✓ throwaway org removed');
    }
    await mongoose.disconnect();
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error('DEBUG SCRIPT FAILED:', e?.message || e);
  process.exit(1);
});
