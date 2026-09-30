/** Isolates the org-scope plugin: does a create inside runWithOrg get orgId? */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import '../models'; // registers models + global plugin
import { LoyaltyConfig } from '../models/LoyaltyConfig';
import { Organization } from '../models/Organization';
import { runWithOrg } from '../middlewares/org.context';

async function run() {
  await connectDB();
  const org = await Organization.findOne({}).lean();
  if (!org) throw new Error('no org');

  const hooked = (LoyaltyConfig.schema as any).s.hooks._pres.size;
  console.log('schema hook count:', hooked);
  console.log('has validate pre:', !!(LoyaltyConfig.schema as any).s.hooks._pres.get('validate')?.length);

  await LoyaltyConfig.deleteMany({});
  try {
    const created = await runWithOrg({ orgId: String(org._id) }, async () => LoyaltyConfig.create({}));
    console.log('created orgId:', created.orgId ? 'STAMPED' : 'MISSING');
  } catch (err: any) {
    console.log('create failed:', err.message);
  }

  // Also test the query filter injection
  const found = await runWithOrg({ orgId: String(org._id) }, async () => LoyaltyConfig.find({}).lean());
  console.log('scoped find count:', found.length, found[0]?.orgId ? '(orgId present)' : '');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
