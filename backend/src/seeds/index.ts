import mongoose from 'mongoose';
import { connectDB } from '../config/db';

// Models must load with the tenant-scoping plugin registered first
import '../models';

import { seedRoles } from './seed-roles';
import { seedAdmin } from './seed-admin';
import { seedSettings } from './seed-settings';
import { seedAccounts } from './seed-accounts';
import { seedExpenseCategories } from './seed-expense-categories';
import { seedDemoData } from './seed-demo-data';
import { ensureMultiOrgBootstrap } from '../services/MultiOrgBootstrapService';
import { Organization } from '../models/Organization';
import { runWithOrg } from '../middlewares/org.context';

async function runSeeds() {
  console.log('🚀 Running database seeds...');
  await connectDB();

  // Seeds target the default organization: make sure it exists and run every
  // org-scoped seeder inside its tenant scope.
  await seedRoles();
  const bootstrap = await ensureMultiOrgBootstrap();
  const org = await Organization.findOne().lean();
  const orgId = bootstrap.orgId || (org ? String(org._id) : undefined);

  const seedOrgScoped = async (fn: () => Promise<void>, label: string) => {
    if (!orgId) {
      console.warn(`⚠️ Skipping ${label}: no organization exists yet`);
      return;
    }
    await runWithOrg({ orgId }, fn);
  };

  await seedAdmin();
  await seedOrgScoped(seedSettings, 'seedSettings');
  await seedOrgScoped(seedAccounts, 'seedAccounts');
  await seedOrgScoped(seedExpenseCategories, 'seedExpenseCategories');
  await seedOrgScoped(seedDemoData, 'seedDemoData');

  console.log('🎉 All seeds completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}


runSeeds().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
