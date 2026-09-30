/**
 * One-time: renames the super admin username to `bdbbc` and renames
 * `admin_user` to `admin`. Passwords stay untouched.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';

async function run() {
  await connectDB();

  // 1. super admin: admin → bdbbc (rename first to free the `admin` handle)
  const superAdmin = await User.findOne({ isPlatformSuperAdmin: true });
  if (!superAdmin) throw new Error('Super admin not found');
  superAdmin.username = 'bdbbc'; // schema lowercases it
  await superAdmin.save();

  // 2. admin_user → admin
  const normalAdmin = await User.findOne({ username: 'admin_user' });
  if (!normalAdmin) throw new Error('admin_user not found');
  normalAdmin.username = 'admin';
  await normalAdmin.save();

  // 3. verify both logins still work with their existing passwords
  const sa = await User.findOne({ username: 'bdbbc' });
  const na = await User.findOne({ username: 'admin' });
  const saOk = sa ? await sa.comparePassword('Bdbbc@2026') : false;
  const naOk = na ? await na.comparePassword('Admin@123') : false;

  console.log(`✓ Super admin username → "bdbbc" | old password still works: ${saOk ? 'YES' : 'NO'}`);
  console.log(`✓ admin_user username → "admin" | old password still works: ${naOk ? 'YES' : 'NO'}`);

  await mongoose.disconnect();
  process.exit(saOk && naOk ? 0 : 1);
}

run().catch((err) => {
  console.error('RENAME FAILED:', err.message);
  process.exit(1);
});
