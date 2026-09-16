import { User } from '../models/User';
import { Role } from '../models/Role';

export const seedAdmin = async (): Promise<void> => {
  const superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
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
      isActive: true,
      terminalLocked: false,
    });
    await admin.save();
    console.log('✅ Default super admin user created (Username: "admin", Password: "Admin@123", PIN: "0000")');
  } else {
    console.log('ℹ️ Super admin user already exists');
  }

  const adminRole = await Role.findOne({ name: 'ADMIN' });
  if (!adminRole) {
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
      roleId: adminRole._id,
      isActive: true,
      terminalLocked: false,
    });
    await normalAdmin.save();
    console.log('✅ Default admin user created (Username: "admin_user", Password: "Admin@123", PIN: "1111")');
  } else {
    console.log('ℹ️ Admin user already exists');
  }
};
