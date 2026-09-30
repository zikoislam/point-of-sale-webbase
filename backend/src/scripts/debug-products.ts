import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Product } from '../models/Product';
import { Organization } from '../models/Organization';
import { runWithOrg } from '../middlewares/org.context';

async function run() {
  await connectDB();
  const products = await Product.find({}).lean();
  const orgs = await Organization.find({}).lean();
  console.log('total products:', products.length);
  for (const p of products) {
    const org = orgs.find((o: any) => String(o._id) === String((p as any).orgId));
    console.log(`  - ${p.name} | orgId=${(p as any).orgId} | org=${org?.name || 'ORPHANED'}`);
  }
  console.log('organizations:', orgs.map((o: any) => `${o.name} (${o.slug})`));

  // scoped check for the main org
  const main = orgs.find((o: any) => o.slug === 'main-organization');
  if (main) {
    const scoped = await runWithOrg({ orgId: String(main._id) }, async () => Product.find({}).lean());
    console.log(`scoped find for main org: ${scoped.length}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
