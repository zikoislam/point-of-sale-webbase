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
    console.log('✅ Default admin user created (Username: "admin", Password: "Admin@123", PIN: "0000")');
  } else {
    console.log('ℹ️ Admin user already exists');
  }
};
