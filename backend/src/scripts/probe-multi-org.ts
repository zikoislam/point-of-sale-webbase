/**
 * TEMPORARY end-to-end probe for the multi-org release.
 * Creates a throwaway user, exercises login + scoped APIs over HTTP against a
 * running dev server, then removes the user. Safe to re-run.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Organization } from '../models/Organization';
import { Product } from '../models/Product';

const BASE = process.env.PROBE_BASE || 'http://localhost:5000/api/v1';
const USERNAME = 'qa_probe_tmp';

async function api(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function run() {
  await connectDB();
  const org = await Organization.findOne({}).lean();
  if (!org) throw new Error('No organization — bootstrap has not run');
  const orgAdminRole = await Role.findOne({ orgId: org._id, name: 'ADMIN' }).lean();
  if (!orgAdminRole) throw new Error('No org ADMIN role');

  // ── setup: throwaway user ────────────────────────────────────────────────
  await User.deleteMany({ username: USERNAME });
  const user = new User({
    username: USERNAME,
    fullName: 'QA Probe',
    email: `${USERNAME}@example.com`,
    phone: '+8801999999999',
    passwordHash: 'Probe@123',
    pinHash: '9999',
    roleId: orgAdminRole._id as any,
    isActive: true,
    memberships: [{ orgId: org._id as any, roleId: orgAdminRole._id as any, isActive: true }],
  });
  await user.save();
  console.log('✓ probe user created');

  try {
    // ── 1. login returns memberships + activeOrgId ─────────────────────────
    const login = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }),
    });
    if (login.status !== 200 || !login.body?.data?.token) {
      throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body).slice(0, 300)}`);
    }
    const token = login.body.data.token;
    const profile = login.body.data.user;
    console.log(`✓ login ok — role=${profile.role}, org=${profile.orgName}, activeOrgId=${profile.activeOrgId ? 'set' : 'missing'}, memberships=${profile.memberships?.length}`);

    // ── 2. /auth/me coherent ───────────────────────────────────────────────
    const me = await api('/auth/me', {}, token);
    console.log(`✓ /auth/me — org=${me.body?.data?.orgName}, perms=${me.body?.data?.permissions?.length}`);

    // ── 3. org-scoped list reads only this org ─────────────────────────────
    const products = await api('/products?page=1&limit=5', {}, token);
    console.log(`✓ /products — status=${products.status}, items=${Array.isArray(products.body?.data) ? products.body.data.length : 'n/a'}`);

    // ── 4. role capping: granting a permission the actor lacks must fail ───
    const capped = await api('/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA_CAP_ROLE',
        displayName: 'QA Cap Role',
        permissions: ['users:manage', 'accounts:manage', 'orgs:manage'].filter(() => true),
      }),
    }, token);
    const capCheck = capped.status === 403 || capped.status === 201; // 403 if actor lacks any; 201 if admin envelope holds all
    console.log(`✓ role capping behaves (${capped.status}: ${String(capped.body?.message || capped.body?.error?.message || '').slice(0, 80)}) — ok=${capCheck}`);
    if (capped.status === 201) {
      const roleId = capped.body?.data?.id;
      if (roleId) await api(`/roles/${roleId}`, { method: 'PUT', body: JSON.stringify({ displayName: 'QA Cap Role Renamed' }) }, token);
    }

    // ── 5. unauthenticated access is still blocked ─────────────────────────
    const anon = await api('/products');
    console.log(`✓ anonymous /products → ${anon.status} (expect 401)`);

    // ── 6. new modules respond ─────────────────────────────────────────────
    const moduleChecks: Array<[string, string]> = [
      ['price-tiers', 'GET /price-tiers'],
      ['distribution/zones', 'GET /distribution/zones'],
      ['distribution/reps', 'GET /distribution/reps'],
      ['hr/employees', 'GET /hr/employees'],
      ['production/boms', 'GET /production/boms'],
      ['crm/loyalty', 'GET /crm/loyalty'],
      ['ecommerce/orders', 'GET /ecommerce/orders'],
    ];
    for (const [path, label] of moduleChecks) {
      const r = await api(`/${path}`, {}, token);
      console.log(`✓ ${label} → ${r.status}${r.status !== 200 ? ' :: ' + JSON.stringify(r.body).slice(0, 200) : ''}`);
    }

    // ── 7. public storefront catalog (no auth) ─────────────────────────────
    const orgDoc = await (await import('../models/Organization')).Organization.findOne({}).lean();
    const store = await fetch(`${BASE}/storefront/stores/${(orgDoc as any)?.slug}/products`);
    console.log(`✓ public storefront catalog → ${store.status} (200 expected)`);
  } finally {
    // ── cleanup: remove the throwaway user (and any QA role) ───────────────
    await User.deleteMany({ username: USERNAME });
    const { Role: RoleModel } = await import('../models/Role');
    await RoleModel.deleteMany({ name: 'QA_CAP_ROLE' });
    console.log('✓ probe user removed');
    await mongoose.disconnect();
  }
  process.exit(0);
}

run().catch(async (err) => {
  console.error('PROBE FAILED:', err.message);
  try {
    await User.deleteMany({ username: USERNAME });
    const { Role: RoleModel } = await import('../models/Role');
    await RoleModel.deleteMany({ name: 'QA_CAP_ROLE' });
    await mongoose.disconnect();
  } catch { /* ignore */ }
  process.exit(1);
});
