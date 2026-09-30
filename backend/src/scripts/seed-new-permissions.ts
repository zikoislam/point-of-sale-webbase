/**
 * One-time helper for existing deployments: brings each organization's ADMIN
 * role up to the organization's permission envelope so the new modules
 * (Pricing, SR/Distribution, HR, Production, CRM, eCommerce) are usable.
 * Run once after upgrading:  npx ts-node --transpile-only src/scripts/seed-new-permissions.ts
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { Role } from '../models/Role';

async function run() {
  await connectDB();
  const orgs = await Organization.find({}).lean();
  for (const org of orgs as any[]) {
    const envelope = org.adminPermissionSet || [];
    const result = await Role.updateMany(
      { orgId: org._id, name: 'ADMIN' },
      { $set: { permissions: envelope } }
    );
    console.log(`✓ ${org.name}: ADMIN role updated (${result.modifiedCount} role doc) to ${envelope.length} permissions`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
