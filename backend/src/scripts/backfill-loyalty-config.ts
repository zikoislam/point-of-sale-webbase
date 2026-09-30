/**
 * Backfill for the loyalty fields added in Phase 9.1.
 *
 * Documents created before the change carry no `maxRedeemPercent`, `expiryDays`
 * or `tiers`, and customers carry no `lifetimePoints` / `loyaltyTier` — Mongo
 * only applies schema defaults to new documents. Run once after deploying:
 *
 *   npx ts-node src/scripts/backfill-loyalty-config.ts
 */
import { connectDB } from '../config/db';
import { LoyaltyConfig } from '../models/LoyaltyConfig';
import { Customer } from '../models/Customer';
import { runWithOrg, runWithoutScope } from '../middlewares/org.context';

const DEFAULT_TIERS = [
  { name: 'SILVER', minLifetimePoints: 0, bonusMultiplier: 1 },
  { name: 'GOLD', minLifetimePoints: 10000, bonusMultiplier: 1.25 },
  { name: 'PLATINUM', minLifetimePoints: 50000, bonusMultiplier: 1.5 },
];

const tierFor = (lifetimePoints: number): string => {
  const ladder = [...DEFAULT_TIERS].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  let current = ladder[0];
  for (const step of ladder) if (lifetimePoints >= step.minLifetimePoints) current = step;
  return current.name;
};

(async () => {
  await connectDB();
  console.log('── backfilling loyalty config + customers ──────────────────');

  const configs: any[] = await runWithoutScope(() => LoyaltyConfig.find({}).lean() as any);
  for (const config of configs) {
    const patch: Record<string, any> = {};
    if (typeof config.maxRedeemPercent !== 'number') patch.maxRedeemPercent = 100;
    if (typeof config.expiryDays !== 'number') patch.expiryDays = 0;
    if (!Array.isArray(config.tiers) || config.tiers.length === 0) patch.tiers = DEFAULT_TIERS;

    if (Object.keys(patch).length === 0) {
      console.log(`  config ${config._id}: already up to date`);
      continue;
    }
    await runWithOrg({ orgId: String(config.orgId) }, () =>
      LoyaltyConfig.updateOne({ _id: config._id }, { $set: patch })
    );
    console.log(`  config ${config._id}: set ${Object.keys(patch).join(', ')}`);
  }

  // Customers who already hold points have no lifetime figure. Their balance is
  // the only evidence available, and using it *understates* the ladder — nobody
  // is promoted to a tier they have not earned.
  const orgIds: string[] = [...new Set(configs.map((c) => String(c.orgId)))];
  let customersFixed = 0;

  for (const orgId of orgIds) {
    const customers: any[] = await runWithOrg({ orgId }, () =>
      Customer.find({
        loyaltyPoints: { $gt: 0 },
        $or: [{ lifetimePoints: { $exists: false } }, { lifetimePoints: 0 }, { loyaltyTier: { $exists: false } }],
      })
        .select('loyaltyPoints lifetimePoints loyaltyTier')
        .lean() as any
    );

    for (const customer of customers) {
      const lifetime = Math.max(customer.lifetimePoints || 0, customer.loyaltyPoints || 0);
      await runWithOrg({ orgId }, () =>
        Customer.updateOne(
          { _id: customer._id },
          { $set: { lifetimePoints: lifetime, loyaltyTier: tierFor(lifetime) } }
        )
      );
      customersFixed += 1;
    }
    if (customers.length) console.log(`  org ${orgId}: ${customers.length} customer(s) given a lifetime/tier`);
  }

  console.log(`\ndone — ${configs.length} config(s) checked, ${customersFixed} customer(s) backfilled`);
  process.exit(0);
})();
