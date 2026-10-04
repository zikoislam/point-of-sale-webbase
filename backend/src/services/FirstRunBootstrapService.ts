import { User } from '../models/User';
import { Role } from '../models/Role';
import { Organization } from '../models/Organization';
import { seedRoles } from '../seeds/seed-roles';
import { seedAdmin } from '../seeds/seed-admin';
import { orgService } from './OrgService';

/**
 * First-run seed for a brand-new database.
 *
 * A freshly installed desktop app (or a brand-new web deployment) starts with an
 * empty MongoDB. `ensureMultiOrgBootstrap()` creates the default organization,
 * but roles and users are normally only created by `npm run seed` — which a
 * shop running a packaged installer cannot run. Without this the first screen
 * is a login with no account to log in with.
 *
 * Runs only when the database has neither roles nor users, so it is a no-op on
 * every existing install and on the shared SaaS database.
 */
export async function ensureFirstRunSeed(): Promise<{ seeded: boolean }> {
  const [hasRoles, hasUsers] = await Promise.all([Role.exists({}), User.exists({})]);
  if (hasRoles && hasUsers) {
    return { seeded: false };
  }

  console.log('🌱 Empty database detected — preparing roles, the default organization and an administrator…');

  // 1. Platform role templates (SUPER_ADMIN, ADMIN, BRANCH_MANAGER, CASHIER).
  await seedRoles();

  // 2. Give the default organization its own roles + baseline data
  //    (settings, chart of accounts, expense categories).
  const org = await Organization.findOne({}).lean();
  if (org) {
    await orgService.provisionOrg(String(org._id), (org as any).adminPermissionSet || []);
  }

  // 3. Default administrator account (admin / Admin@123). The user is expected
  //    to change the password on first login.
  await seedAdmin();

  console.log('✅ First-run setup complete — sign in with admin / Admin@123 and change the password.');
  return { seeded: true };
}
