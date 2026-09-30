import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Settings } from '../models/Settings';
import { Category } from '../models/Category';
import { Account } from '../models/Account';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { Counter } from '../models/Counter';

/** Removes leftover QA isolation organizations and their data. */
async function run() {
  await connectDB();
  const leftovers = await Organization.find({ slug: /^qa-isolation-org/ }).lean();
  for (const org of leftovers as any[]) {
    await Product.deleteMany({ orgId: org._id });
    await Settings.deleteMany({ orgId: org._id });
    await Role.deleteMany({ orgId: org._id });
    await Category.deleteMany({ orgId: org._id });
    await Account.deleteMany({ orgId: org._id });
    await ExpenseCategory.deleteMany({ orgId: org._id });
    await Counter.deleteMany({ _id: new RegExp(`^${org._id}_`) });
    await Organization.deleteOne({ _id: org._id });
    console.log(`✓ removed leftover org: ${org.name} (${org.slug})`);
  }
  if (leftovers.length === 0) console.log('ℹ️ no leftovers');
  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
