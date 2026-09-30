/** One-time check: does admin_user still use the seeded default password? */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';

async function run() {
  await connectDB();
  const user = await User.findOne({ username: 'admin_user' });
  if (!user) {
    console.log('admin_user not found in the database');
  } else {
    const pwOk = await user.comparePassword('Admin@123');
    const pinOk = await user.comparePin('1111');
    console.log(`user: admin_user | isActive: ${user.isActive} | isPlatformSuperAdmin: ${user.isPlatformSuperAdmin}`);
    console.log(`default password (Admin@123) works: ${pwOk ? 'YES' : 'NO — it was changed'}`);
    console.log(`default PIN (1111) works: ${pinOk ? 'YES' : 'NO — it was changed'}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e.message); process.exit(1); });
