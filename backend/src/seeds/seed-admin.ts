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

  // A fresh install ships with ONLY the platform Super Admin. Shop users
  // (cashier / manager) are created from the Users page afterwards, so a new
  // box never starts with a second administrator nobody asked for.
};
