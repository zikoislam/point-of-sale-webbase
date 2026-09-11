import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { seedRoles } from './seed-roles';
import { seedAdmin } from './seed-admin';
import { seedSettings } from './seed-settings';
import { seedAccounts } from './seed-accounts';
import { seedExpenseCategories } from './seed-expense-categories';
import { seedDemoData } from './seed-demo-data';

async function runSeeds() {
  console.log('🚀 Running database seeds...');
  await connectDB();

  await seedRoles();
  await seedAdmin();
  await seedSettings();
  await seedAccounts();
  await seedExpenseCategories();
  await seedDemoData();

  console.log('🎉 All seeds completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}


runSeeds().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
