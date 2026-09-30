import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { Role } from '../models/Role';
import { Settings } from '../models/Settings';
import { Account } from '../models/Account';

async function run() {
  await connectDB();

  const orgs = await Organization.find({}).lean();
  console.log(`organizations: ${orgs.length}`);
  orgs.forEach((o: any) => console.log(`  - ${o.name} (${o.slug}, ${o.status}, perms=${o.adminPermissionSet?.length})`));

  const users = await User.find({}).lean();
  const withMembership = users.filter((u: any) => (u.memberships || []).length > 0);
  const superAdmins = users.filter((u: any) => u.isPlatformSuperAdmin);
  console.log(`users: ${users.length}, with memberships: ${withMembership.length}, platform super admins: ${superAdmins.length}`);

  const [productsTotal, productsStamped, salesTotal, salesStamped, rolesTotal, orgRoles, accountsTotal, accountsStamped, settingsCount] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ orgId: { $exists: true } }),
    Sale.countDocuments({}),
    Sale.countDocuments({ orgId: { $exists: true } }),
    Role.countDocuments({}),
    Role.countDocuments({ orgId: { $ne: null } }),
    Account.countDocuments({}),
    Account.countDocuments({ orgId: { $exists: true } }),
    Settings.countDocuments({}),
  ]);
  console.log(`products: ${productsStamped}/${productsTotal} stamped`);
  console.log(`sales: ${salesStamped}/${salesTotal} stamped`);
  console.log(`accounts: ${accountsStamped}/${accountsTotal} stamped`);
  console.log(`roles: ${rolesTotal} total, ${orgRoles} org-scoped`);
  console.log(`settings docs: ${settingsCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
