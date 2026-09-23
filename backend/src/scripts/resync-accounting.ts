/**
 * Rebuilds every cached account balance from the journal.
 *
 *   npx ts-node --transpile-only src/scripts/resync-accounting.ts [--write]
 *
 * The journal is the source of truth; this repairs drift between it and
 * Account.currentBalance. Dry run unless --write is passed.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { accountingService } from '../services/AccountingService';

const WRITE = process.argv.includes('--write');
const money = (n: number) => n.toFixed(2);

async function main() {
  await connectDB();

  const fixes = await accountingService.resyncBalances();

  if (fixes.length === 0) {
    console.log('\nAll cached balances already agree with the journal.\n');
  } else {
    console.log('\n=== balances that disagree with the journal ===');
    for (const f of fixes) {
      console.log(`  ${(f.code || '----')} ${f.account.padEnd(26)} was ${money(f.was).padStart(14)}  ->  ${money(f.now).padStart(14)}`);
    }
    console.log(`\n  ${fixes.length} balance(s) corrected${WRITE ? '' : ' (dry run — nothing written)'}`);
  }

  if (WRITE) {
    const trial = await accountingService.getTrialBalance();
    const sheet = await accountingService.getBalanceSheet();
    console.log(`\n  trial balance: ${money(trial.totalDebit)} vs ${money(trial.totalCredit)} — ${trial.balanced ? 'balanced' : 'OUT OF BALANCE'}`);
    console.log(`  balance sheet: ${money(sheet.totalAssets)} vs ${money(sheet.totalLiabilitiesAndEquity)} — ${sheet.balanced ? 'balanced' : 'OUT OF BALANCE'}\n`);
  } else if (fixes.length) {
    console.log('Re-run with --write to apply.\n');
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('RESYNC FAILED:', e.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
