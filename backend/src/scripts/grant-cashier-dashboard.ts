/**
 * Grants `reports:dashboard` to every CASHIER role and to every organization's
 * permission envelope, so cashiers can open the dashboard.
 *
 *   npx ts-node src/scripts/grant-cashier-dashboard.ts
 *
 * Idempotent — safe to run more than once. Runs outside any tenant scope so it
 * touches every organization at once.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Role } from '../models/Role';
import { Organization } from '../models/Organization';
import { runWithoutScope } from '../middlewares/org.context';

async function run() {
  await connectDB();

  await runWithoutScope(async () => {
    const roles = await Role.updateMany(
      { name: 'CASHIER' },
      { $addToSet: { permissions: 'reports:dashboard' } }
    );
    const orgs = await Organization.updateMany(
      {},
      { $addToSet: { adminPermissionSet: 'reports:dashboard' } }
    );
    console.log(`   ✓ ${roles.modifiedCount} CASHIER role(s) updated`);
    console.log(`   ✓ ${orgs.modifiedCount} organization envelope(s) updated`);
  });

  console.log('🎉 Cashier dashboard access granted.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ failed:', err);
  process.exit(1);
});
