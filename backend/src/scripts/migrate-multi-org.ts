/**
 * Standalone multi-organization migration.
 *
 *   npx ts-node src/scripts/migrate-multi-org.ts
 *
 * Idempotent — the server also runs this automatically on boot. See
 * MultiOrgBootstrapService for what it does.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { ensureMultiOrgBootstrap } from '../services/MultiOrgBootstrapService';

async function run() {
  await connectDB();
  const result = await ensureMultiOrgBootstrap();
  if (result.created) {
    console.log('🎉 Migration finished: single-shop data now lives in the default organization.');
  } else {
    console.log('ℹ️ Nothing to do — default organization already exists.');
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
