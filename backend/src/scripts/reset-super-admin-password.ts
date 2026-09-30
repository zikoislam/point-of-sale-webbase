/**
 * One-time: resets the platform Super Admin's password + PIN.
 *   npx ts-node --transpile-only src/scripts/reset-super-admin-password.ts
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';

const NEW_PASSWORD = 'Bdbbc@2026';
const NEW_PIN = '0000';

async function run() {
  await connectDB();

  let user = await User.findOne({ isPlatformSuperAdmin: true });
  if (!user) user = await User.findOne({ username: 'admin' });
  if (!user) throw new Error('No super admin user found in the database');

  user.passwordHash = NEW_PASSWORD; // pre-save hook bcrypt-hashes it
  user.pinHash = NEW_PIN;
  user.isActive = true;
  await user.save();

  // Verify the new credentials actually work against the stored hash
  const check = await User.findById(user._id);
  const passwordOk = await check!.comparePassword(NEW_PASSWORD);
  const pinOk = await check!.comparePin(NEW_PIN);

  console.log(`✓ Super admin "${user.username}" reset`);
  console.log(`  password verify: ${passwordOk ? 'OK' : 'FAILED'}`);
  console.log(`  PIN verify:      ${pinOk ? 'OK' : 'FAILED'}`);

  await mongoose.disconnect();
  process.exit(passwordOk && pinOk ? 0 : 1);
}

run().catch((err) => {
  console.error('RESET FAILED:', err.message);
  process.exit(1);
});
