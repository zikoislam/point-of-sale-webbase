/**
 * Loyalty logic test (Phase 9.1) — runs the real service, no HTTP, no sales.
 *
 * Proves the arithmetic the till depends on: earning with a tier bonus, the
 * per-bill redemption cap, the minimum-to-redeem, lifetime points, tier
 * promotion, the movement ledger and the expiry sweep.
 *
 * Everything happens on a throwaway customer inside the org's own scope and is
 * removed (and the config restored) before the script exits.
 *
 *   npx ts-node src/scripts/tmp-loyalty-logic-test.ts
 */
import { connectDB } from '../config/db';
// Imported through the barrel on purpose: it registers the tenant-scoping
// plugin before any schema is built, exactly as the app does.
import { Organization, Customer, LoyaltyTransaction } from '../models';
import { loyaltyService } from '../services/LoyaltyService';
import { runWithOrg, runWithoutScope } from '../middlewares/org.context';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
};

(async () => {
  await connectDB();
  console.log('── loyalty logic (earn / redeem / tier / expiry) ───────────\n');

  const org: any = await runWithoutScope(() => Organization.findOne().lean() as any);
  if (!org) {
    console.log('  ✗ no organization found');
    process.exit(1);
  }
  const orgId = String(org._id);

  await runWithOrg({ orgId }, async () => {
    const original: any = await loyaltyService.getConfig();
    const originalSnapshot = {
      pointsPerTk: original.pointsPerTk,
      redeemValuePerPoint: original.redeemValuePerPoint,
      minPointsToRedeem: original.minPointsToRedeem,
      maxRedeemPercent: original.maxRedeemPercent,
      expiryDays: original.expiryDays,
      tiers: original.tiers,
      isActive: original.isActive,
    };

    let customerId = '';
    try {
      const customer: any = await Customer.create({
        name: 'QA Loyalty Customer',
        phone: '01900000933',
        customerType: 'RETAIL',
      });
      customerId = String(customer._id);

      // Deterministic rules so the arithmetic is checkable
      await loyaltyService.updateConfig({
        isActive: true,
        pointsPerTk: 0.05,
        redeemValuePerPoint: 0.5,
        minPointsToRedeem: 100,
        maxRedeemPercent: 50,
        expiryDays: 0,
      } as any);

      /* ── earning ── */
      const quote = await loyaltyService.calculateEarn(500, customerId);
      check('earn quote: ৳500 × 0.05 = 25 point(s)', quote.points === 25, `${quote.points} point(s), ×${quote.bonusMultiplier}`);

      const earned = await loyaltyService.applyEarn(customerId, null, 500);
      let state: any = await Customer.findById(customerId).lean();
      check('earning credits the balance', state.loyaltyPoints === earned.points, `balance ${state.loyaltyPoints}`);
      check('earning credits lifetime too', state.lifetimePoints === earned.points, `lifetime ${state.lifetimePoints}`);
      check('tier assigned from lifetime', state.loyaltyTier === 'SILVER', state.loyaltyTier);

      /* ── the cap that protects the margin ── */
      await loyaltyService.applyEarn(customerId, null, 5000); // → 250 more, balance 275
      const eligibility = await loyaltyService.maxRedeemable(customerId, 100);
      check(
        'redeem cap: 50% of a ৳100 bill = 100 points',
        eligibility.maxPoints === 100,
        `balance ${eligibility.balance}, maxPoints ${eligibility.maxPoints}`
      );
      check('minimum-to-redeem surfaced', eligibility.minPoints === 100, `${eligibility.minPoints}`);

      const redeemed = await loyaltyService.applyRedeem(customerId, null, 100);
      check('redemption value: 100 × 0.5 = ৳50', redeemed.value === 50, `৳${redeemed.value}`);
      state = await Customer.findById(customerId).lean();
      check('redemption debits the balance', state!.loyaltyPoints === 175, `balance ${state!.loyaltyPoints}`);
      check('redemption never touches lifetime', state!.lifetimePoints === 275, `lifetime ${state!.lifetimePoints}`);

      /* ── tier promotion changes the earn rate ── */
      // ৳250,000 × 0.05 = 12,500 points, which carries lifetime past the GOLD rung.
      const crossing = await loyaltyService.applyEarn(customerId, null, 250000);
      state = await Customer.findById(customerId).lean();
      check('promotion to GOLD once lifetime passes 10,000', state!.loyaltyTier === 'GOLD', `${state!.loyaltyTier} at lifetime ${state!.lifetimePoints}`);
      check(
        'the earning that crossed still used the old tier (×1)',
        crossing.bonusMultiplier === 1 && crossing.points === 12500,
        `${crossing.points} point(s) at ×${crossing.bonusMultiplier}`
      );

      const afterPromotion = await loyaltyService.applyEarn(customerId, null, 1000);
      check(
        'GOLD earnings now carry the ×1.25 bonus',
        afterPromotion.points === 62 && afterPromotion.bonusMultiplier === 1.25,
        `${afterPromotion.points} point(s) at ×${afterPromotion.bonusMultiplier}`
      );

      /* ── the movement ledger ── */
      state = await Customer.findById(customerId).lean(); // re-read after the last earn
      const movements = await LoyaltyTransaction.find({ customerId }).sort({ createdAt: 1 }).lean();
      const types = movements.map((m: any) => m.type);
      check(
        'every movement is recorded',
        types.filter((t) => t === 'EARN').length === 4 && types.filter((t) => t === 'REDEEM').length === 1,
        types.join(', ')
      );
      check(
        'balances run in step',
        movements[movements.length - 1].balanceAfter === state!.loyaltyPoints,
        `last row ${movements[movements.length - 1].balanceAfter} vs customer ${state!.loyaltyPoints}`
      );

      const statement = await loyaltyService.getCustomerStatement(customerId, 1, 30);
      check(
        'statement totals the movements',
        statement.total === 5 && statement.customer.lifetimePoints === state!.lifetimePoints,
        `${statement.total} movement(s)`
      );
      check('statement values the balance', statement.program.pointValue > 0, `worth ${statement.program.pointValue}`);

      /* ── expiry: backdate an earning and sweep ── */
      await LoyaltyTransaction.create({
        customerId,
        type: 'EARN',
        points: 50,
        balanceAfter: state!.loyaltyPoints + 50,
        lifetimeAfter: state!.lifetimePoints + 50,
        narration: 'QA backdated earning',
        expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // expired two days ago
      });
      await Customer.updateOne({ _id: customerId }, { $inc: { loyaltyPoints: 50, lifetimePoints: 50 } });
      await loyaltyService.updateConfig({ expiryDays: 1 } as any);

      const beforeSweep: any = await Customer.findById(customerId).lean();
      const sweep = await loyaltyService.expirePoints();
      const afterSweep: any = await Customer.findById(customerId).lean();
      const expireRow: any = await LoyaltyTransaction.findOne({ customerId, type: 'EXPIRE' }).lean();

      check('sweep expired the lapsed points', afterSweep.loyaltyPoints === beforeSweep.loyaltyPoints - 50, `${beforeSweep.loyaltyPoints} → ${afterSweep.loyaltyPoints}`);
      check('sweep wrote an EXPIRE movement', !!expireRow && expireRow.points === 50, expireRow ? `${expireRow.points} pts · ${expireRow.narration}` : 'missing');
      check('sweep reports what it did', sweep.points === 50 && sweep.customers === 1, JSON.stringify(sweep));
      check('lifetime is not reduced by expiry', afterSweep.lifetimePoints === beforeSweep.lifetimePoints, `${afterSweep.lifetimePoints}`);

      /* ── inactive programme earns nothing ── */
      await loyaltyService.updateConfig({ isActive: false } as any);
      const idle = await loyaltyService.calculateEarn(1000, customerId);
      check('a paused programme earns no points', idle.points === 0, `${idle.points} point(s)`);
    } finally {
      // Clean up the throwaway customer and every row it produced
      await LoyaltyTransaction.deleteMany({ customerId });
      await Customer.findByIdAndDelete(customerId);
      await loyaltyService.updateConfig(originalSnapshot as any);
      const restored: any = await loyaltyService.getConfig();
      console.log(
        `\n  cleaned up · config restored (pointsPerTk ${restored.pointsPerTk}, max ${restored.maxRedeemPercent}%, expiry ${restored.expiryDays}d, ${(restored.tiers || []).length} tiers)`
      );
    }
  });

  console.log(`\nresult: ${failures === 0 ? 'PASSED' : `FAILED (${failures})`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
