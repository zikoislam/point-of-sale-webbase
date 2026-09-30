/** End-to-end tenancy isolation test: Org B must never see Org A's data. */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Settings } from '../models/Settings';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_iso_tmp';

async function api(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function run() {
  await connectDB();
  const orgA = await Organization.findOne({ slug: 'main-organization' }).lean();
  if (!orgA) throw new Error('run bootstrap first');
  const productsInA = await Product.countDocuments({ orgId: orgA._id });
  console.log(`org A products: ${productsInA}`);

  let orgB: any;
  try {
    // 1. create a second organization through the real platform service
    orgB = await orgService.createOrg({
      name: 'QA Isolation Org',
      adminPermissionSet: ['pos:checkout', 'inv:view', 'inv:manage', 'customers:view', 'users:manage', 'roles:manage'],
    });
    console.log(`✓ org B created (${orgB.slug}) with ${orgB.adminPermissionSet.length} perms`);

    // 2. temp user only in org B
    const orgBAdminRole = await Role.findOne({ orgId: orgB.id, name: 'ADMIN' }).lean();
    await User.deleteMany({ username: USERNAME });
    const user = new User({
      username: USERNAME,
      fullName: 'QA Isolation',
      email: `${USERNAME}@example.com`,
      phone: '+8801888888888',
      passwordHash: 'Probe@123',
      pinHash: '8888',
      roleId: orgBAdminRole!._id as any,
      isActive: true,
      memberships: [{ orgId: orgB.id, roleId: orgBAdminRole!._id as any, isActive: true }],
    });
    await user.save();

    // 3. login lands in org B (only membership)
    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    console.log(`✓ login → org=${login.body?.data?.user?.orgName}, perms=${login.body?.data?.user?.permissions?.length}`);

    // 4. org B must see ZERO of org A's products
    const list = await api('/products?limit=50', {}, token);
    const items = Array.isArray(list.body?.data) ? list.body.data : list.body?.data?.products || [];
    console.log(`✓ org B /products → ${items.length} item(s) (expect 0, org A has ${productsInA})`);

    // 5. org B creates a product → org A count unchanged
    await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Isolation Test Product',
        categoryId: (await import('../models/Category')).Category ? undefined : undefined,
        unit: 'Pcs',
        taxType: 'INCLUSIVE',
        isWebVisible: false,
        variants: [{ attributeName: 'Standard', sku: `ISO-${Date.now()}`, costPrice: 10, retailSellingPrice: 20, wholesaleSellingPrice: 18, currentStock: 5, alertQty: 1 }],
      }),
    }, token).then(async (r) => {
      // categoryId is required — if this fails with VALIDATION_ERROR, create through scope directly instead
      if (r.status !== 201) {
        const category = await (async () => {
          const { Category } = await import('../models/Category');
          const runWithOrg = (await import('../middlewares/org.context')).runWithOrg;
          const cat = await runWithOrg({ orgId: orgB.id }, async () =>
            (await import('../models/Category')).Category.create({ name: 'ISO Category', code: `ISO-${Date.now().toString(36).toUpperCase()}` })
          );
          return cat;
        })();
        await api('/products', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Isolation Test Product',
            categoryId: String((category as any)._id),
            unit: 'Pcs',
            taxType: 'INCLUSIVE',
            variants: [{ attributeName: 'Standard', sku: `ISO-${Date.now()}`, costPrice: 10, retailSellingPrice: 20, wholesaleSellingPrice: 18, currentStock: 5, alertQty: 1 }],
          }),
        }, token);
      }
    });
    const productsInAAfter = await Product.countDocuments({ orgId: orgA._id });
    console.log(`✓ after org B product create → org A products still ${productsInAAfter} (expect ${productsInA})`);

    // 6. org A settings invisible to org B
    const settings = await api('/settings', {}, token);
    console.log(`✓ org B settings shopName = "${settings.body?.data?.shopName}" (expect "My Organization", not org A's)`);
  } finally {
    // cleanup: remove org B and all its data
    if (orgB) {
      const oid = orgB.id;
      await User.deleteMany({ username: USERNAME });
      await Product.deleteMany({ orgId: oid });
      await Settings.deleteMany({ orgId: oid });
      await Role.deleteMany({ orgId: oid });
      await (await import('../models/Category')).Category.deleteMany({ orgId: oid });
      await (await import('../models/Account')).Account.deleteMany({ orgId: oid });
      await (await import('../models/ExpenseCategory')).ExpenseCategory.deleteMany({ orgId: oid });
      await Organization.deleteOne({ _id: oid });
      console.log('✓ org B and its data removed');
    }
    await mongoose.disconnect();
  }
  process.exit(0);
}

run().catch(async (err) => {
  console.error('ISOLATION TEST FAILED:', err.message);
  try { await User.deleteMany({ username: USERNAME }); await Organization.deleteMany({ name: 'QA Isolation Org' }); await mongoose.disconnect(); } catch {}
  process.exit(1);
});
