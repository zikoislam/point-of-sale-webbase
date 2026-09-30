import { User } from '../models/User';
import { Role } from '../models/Role';
import { Organization } from '../models/Organization';

export const seedAdmin = async (): Promise<void> => {
  const superAdminRole = await Role.findOne({ orgId: null, name: 'SUPER_ADMIN' });
  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role must be seeded before creating admin user.');
  }

  const existingAdmin = await User.findOne({ username: 'admin' });
  if (!existingAdmin) {
    const admin = new User({
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@possystem.com',
      phone: '+8801700000000',
      passwordHash: 'Admin@123', // Will be hashed by pre-save hook
      pinHash: '0000', // Will be hashed by pre-save hook
      roleId: superAdminRole._id,
      isPlatformSuperAdmin: true,
      isActive: true,
      terminalLocked: false,
      memberships: [],
    });

    // Give the platform super admin an ADMIN membership in every org so the
    // switcher works out of the box on a fresh install.
    const orgs = await Organization.find({ status: 'ACTIVE' });
    const adminRole = await Role.findOne({ name: 'ADMIN' }).lean();
    for (const org of orgs) {
      const orgAdminRole = await Role.findOne({ orgId: org._id, name: 'ADMIN' });
      admin.memberships.push({
        orgId: org._id,
        roleId: (orgAdminRole?._id || adminRole?._id || superAdminRole._id) as any,
        isActive: true,
      });
    }

    await admin.save();
    console.log('✅ Default super admin user created (Username: "admin", Password: "Admin@123", PIN: "0000")');
  } else {
    if (!existingAdmin.isPlatformSuperAdmin) {
      existingAdmin.isPlatformSuperAdmin = true;
      await existingAdmin.save();
    }
    console.log('ℹ️ Super admin user already exists');
  }

  const adminRoleTemplate = await Role.findOne({ name: 'ADMIN' });
  if (!adminRoleTemplate) {
    throw new Error('ADMIN role must be seeded before creating admin user.');
  }

  const existingNormalAdmin = await User.findOne({ username: 'admin_user' });
  if (!existingNormalAdmin) {
    const normalAdmin = new User({
      username: 'admin_user',
      fullName: 'Administrator',
      email: 'admin_user@possystem.com',
      phone: '+8801700000001',
      passwordHash: 'Admin@123',
      pinHash: '1111',
      roleId: adminRoleTemplate._id,
      isActive: true,
      terminalLocked: false,
      memberships: [],
    });

    // Member of the first organization with the org-scoped ADMIN role
    const firstOrg = await Organization.findOne({ status: 'ACTIVE' }).lean();
    if (firstOrg) {
      const orgAdminRole = await Role.findOne({ orgId: firstOrg._id, name: 'ADMIN' });
      normalAdmin.memberships.push({
        orgId: firstOrg._id,
        roleId: (orgAdminRole?._id || adminRoleTemplate._id) as any,
        isActive: true,
      });
    }

    await normalAdmin.save();
    console.log('✅ Default admin user created (Username: "admin_user", Password: "Admin@123", PIN: "1111")');
  } else {
    console.log('ℹ️ Admin user already exists');
  }
};
