/**
 * Idempotent subscription migration.
 *
 *   npx ts-node src/scripts/migrate-subscriptions.ts
 *   npx ts-node src/scripts/migrate-subscriptions.ts --trial-days 30
 *
 * Makes the SaaS subscription layer safe to deploy onto an existing database:
 *  - grants the new `subscription:manage` permission to every organization's
 *    envelope and ADMIN role so org admins can redeem license keys;
 *  - backfills `subscriptionGraceDays` where missing;
 *  - leaves `subscriptionEndsAt` NULL (unlimited) unless `--trial-days` is
 *    passed, so no existing install is locked by surprise.
 *
 * Runs outside any tenant scope so it can touch every organization at once.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { Role } from '../models/Role';
import { runWithoutScope } from '../middlewares/org.context';
import { env } from '../config/env';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTrialDays(): number | null {
  const flagIndex = process.argv.indexOf('--trial-days');
  if (flagIndex === -1) return null;
  const raw = process.argv[flagIndex + 1];
  const value = parseInt(raw || '', 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('--trial-days expects a positive integer');
  }
  return value;
}

async function run() {
  await connectDB();
  const trialDays = parseTrialDays();

  await runWithoutScope(async () => {
    const envelopeResult = await Organization.updateMany(
      {},
      { $addToSet: { adminPermissionSet: 'subscription:manage' } }
    );

    const graceResult = await Organization.updateMany(
      { $or: [{ subscriptionGraceDays: { $exists: false } }, { subscriptionGraceDays: null }] },
      { $set: { subscriptionGraceDays: env.SUBSCRIPTION_DEFAULT_GRACE_DAYS } }
    );

    const roleResult = await Role.updateMany(
      { name: 'ADMIN' },
      { $addToSet: { permissions: 'subscription:manage' } }
    );

    console.log(`   ✓ ${envelopeResult.modifiedCount} organization envelope(s) given subscription:manage`);
    console.log(`   ✓ ${graceResult.modifiedCount} organization(s) given a default grace window`);
    console.log(`   ✓ ${roleResult.modifiedCount} ADMIN role(s) given subscription:manage`);

    if (trialDays !== null) {
      const endsAt = new Date(Date.now() + trialDays * MS_PER_DAY);
      const trialResult = await Organization.updateMany(
        { $or: [{ subscriptionEndsAt: null }, { subscriptionEndsAt: { $exists: false } }] },
        { $set: { subscriptionEndsAt: endsAt, subscriptionPlan: 'TRIAL' } }
      );
      console.log(`   ✓ ${trialResult.modifiedCount} organization(s) given a ${trialDays}-day trial`);
    } else {
      console.log('   ℹ️ Existing organizations left unlimited (pass --trial-days N to set a trial).');
    }
  });

  console.log('🎉 Subscription migration finished.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Subscription migration failed:', err);
  process.exit(1);
});
