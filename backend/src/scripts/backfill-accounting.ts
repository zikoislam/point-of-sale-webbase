/**
 * Rebuilds the accounting history from the documents the app already holds.
 *
 *   npx ts-node --transpile-only src/scripts/backfill-accounting.ts           # dry run
 *   npx ts-node --transpile-only src/scripts/backfill-accounting.ts --write   # apply
 *
 * It never changes sales, expenses, purchase orders or any wallet ledger — it
 * only reads them and writes journal entries. The last step forces every control
 * account to agree with its sub-ledger (wallets to their balance, receivable to
 * the customer dues, payable to the supplier balances, inventory to the live
 * stock valuation), so the books start from a known-good position.
 *
 * Everything runs inside one Mongo session: a dry run simply aborts it, so
 * nothing is written unless --write is passed.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Account } from '../models/Account';
import { JournalEntry } from '../models/JournalEntry';
import { Sale } from '../models/Sale';
import { Expense } from '../models/Expense';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { StockMovement } from '../models/StockMovement';
import { Customer } from '../models/Customer';
import { Supplier } from '../models/Supplier';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { accountingService, HEADS, JournalLineInput } from '../services/AccountingService';
import {
  postSaleJournals,
  postExpenseJournal,
  postWastageJournal,
  postPurchaseReceiveJournal,
} from '../services/accounting-postings';
import { roundMoney } from '../utils/helpers';

const WRITE = process.argv.includes('--write');
const money = (n: number) => roundMoney(n).toFixed(2);

async function main() {
  await connectDB();

  const already = await JournalEntry.findOne({ source: 'BACKFILL' }).lean();
  if (already) {
    console.log(`ABORT: a backfill voucher already exists (${already.entryNo}). Nothing was written.`);
    process.exit(1);
  }

  const admin = await User.findOne().sort({ createdAt: 1 }).lean();
  if (!admin) throw new Error('No user found to attribute journal entries to');
  const userId = String(admin._id);

  // The chart must exist before anything posts — this part is idempotent.
  await accountingService.seedChart();

  const heads = await accountingService.headsByCode();
  const wallets = await Account.find({ isCashEquivalent: true }).lean();
  const products = await Product.find({ isActive: true }).lean();
  const customers = await Customer.find().lean();
  const suppliers = await Supplier.find().lean();

  // What the books must agree with once the replay is done.
  const stockValue = roundMoney(
    products.reduce((n, p) => n + p.variants.reduce((m, v) => m + (v.currentStock || 0) * (v.costPrice || 0), 0), 0)
  );

  const targets = new Map<string, { name: string; target: number; code: string }>();
  for (const w of wallets) {
    targets.set(String(w._id), { name: w.name, target: roundMoney(w.currentBalance || 0), code: w.code || '' });
  }
  targets.set(String(heads[HEADS.RECEIVABLE]._id), {
    name: 'Accounts Receivable',
    target: roundMoney(customers.reduce((n, c) => n + (c.currentDueBalance || 0), 0)),
    code: HEADS.RECEIVABLE,
  });
  targets.set(String(heads[HEADS.PAYABLE]._id), {
    name: 'Accounts Payable',
    target: roundMoney(suppliers.reduce((n, s) => n + (s.currentPayableBalance || 0), 0)),
    code: HEADS.PAYABLE,
  });
  targets.set(String(heads[HEADS.INVENTORY]._id), { name: 'Inventory', target: stockValue, code: HEADS.INVENTORY });

  const counts: Record<string, number> = {};
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ---- replay the documents ----------------------------------------
    const expenses = await Expense.find({ status: 'APPROVED' }).sort({ createdAt: 1 }).session(session);
    for (const expense of expenses) {
      const category = await ExpenseCategory.findById(expense.categoryId).session(session).lean();
      const res = await postExpenseJournal(expense.toObject(), category, userId, session);
      if (res.posted) counts.EXPENSE = (counts.EXPENSE || 0) + 1;
    }

    const sales = await Sale.find().sort({ createdAt: 1 }).session(session);
    for (const sale of sales) {
      const res = await postSaleJournals(sale.toObject(), userId, session);
      if (res.posted) counts.SALE = (counts.SALE || 0) + 1;
    }

    const orders = await PurchaseOrder.find({ status: { $in: ['RECEIVED', 'PARTIAL'] } }).sort({ createdAt: 1 }).session(session);
    for (const po of orders) {
      const value = roundMoney(
        (po.items || []).reduce((n: number, item: any) => n + (Number(item.receivedQty) || 0) * (Number(item.unitCost) || 0), 0)
      );
      if (value <= 0) continue;
      const res = await postPurchaseReceiveJournal({
        amount: value,
        supplierName: String((po as any).supplierName || 'Supplier'),
        poNumber: po.poNumber,
        date: po.actualReceivedDate || po.createdAt,
        referenceId: po._id,
        userId,
        session,
      });
      if (res.posted) counts.PURCHASE = (counts.PURCHASE || 0) + 1;
    }

    const wastages = await StockMovement.find({ type: 'WASTAGE' }).sort({ createdAt: 1 }).session(session);
    for (const m of wastages) {
      const value = roundMoney((m.quantity || 0) * (m.unitCost || 0));
      if (value <= 0) continue;
      const res = await postWastageJournal({
        amount: value,
        note: m.reason || 'Wastage',
        date: m.createdAt,
        referenceId: m._id,
        userId,
        session,
      });
      if (res.posted) counts.WASTAGE = (counts.WASTAGE || 0) + 1;
    }

    // ---- force every control account onto its sub-ledger --------------
    const lines: JournalLineInput[] = [];
    const reconciliation: Array<{ name: string; code: string; ledger: number; target: number; diff: number }> = [];

    for (const [accountId, meta] of targets) {
      const account = await Account.findById(accountId).session(session).lean();
      if (!account) continue;
      const ledger = roundMoney(account.currentBalance || 0);
      const diff = roundMoney(meta.target - ledger);
      reconciliation.push({ name: meta.name, code: meta.code, ledger, target: meta.target, diff });
      if (Math.abs(diff) < 0.005) continue;

      const increase = diff > 0;
      const debit = (account.normalBalance === 'DEBIT') === increase ? Math.abs(diff) : 0;
      lines.push({ accountId, debit, credit: debit > 0 ? 0 : Math.abs(diff), memo: 'Opening / brought forward' });
    }

    const debitSum = roundMoney(lines.reduce((n, l) => n + (Number(l.debit) || 0), 0));
    const creditSum = roundMoney(lines.reduce((n, l) => n + (Number(l.credit) || 0), 0));
    const offset = roundMoney(debitSum - creditSum);
    if (lines.length) {
      if (offset > 0) lines.push({ accountCode: HEADS.OPENING_EQUITY, credit: offset, memo: 'Brought forward' });
      else if (offset < 0) lines.push({ accountCode: HEADS.OPENING_EQUITY, debit: -offset, memo: 'Brought forward' });
    }

    // ---- report -------------------------------------------------------
    console.log('\n=== vouchers replayed from documents ===');
    for (const [source, n] of Object.entries(counts)) console.log(`  ${source.padEnd(10)} ${n}`);
    console.log(`  ${'total'.padEnd(10)} ${Object.values(counts).reduce((a, b) => a + b, 0)}`);

    console.log('\n=== reconciliation (ledger vs sub-ledger / live value) ===');
    console.log('  ' + 'account'.padEnd(26) + 'ledger'.padStart(16) + 'target'.padStart(16) + 'difference'.padStart(16));
    for (const r of reconciliation) {
      const flag = Math.abs(r.diff) < 0.005 ? 'ok' : 'balanced in';
      console.log(
        '  ' +
          `${r.code} ${r.name}`.slice(0, 25).padEnd(26) +
          money(r.ledger).padStart(16) +
          money(r.target).padStart(16) +
          money(r.diff).padStart(16) +
          '  ' + flag
      );
    }
    console.log(`\n  brought-forward entry: ${lines.length ? lines.length + ' lines' : 'not needed'}`);

    if (!WRITE) {
      await session.abortTransaction();
      session.endSession();
      console.log('\nDRY RUN — nothing was written. Re-run with --write to apply.\n');
      await mongoose.disconnect();
      return;
    }

    if (lines.length) {
      const entry = await accountingService.postJournal({
        date: new Date(),
        narration: 'Opening / brought-forward balances',
        source: 'BACKFILL',
        createdById: userId,
        isSystemGenerated: true,
        session,
        lines,
      });
      console.log(`\n  posted ${entry.entryNo}`);
    } else {
      await JournalEntry.create(
        [
          {
            entryNo: `BACKFILL-${Date.now()}`,
            date: new Date(),
            narration: 'Backfill marker (no adjustment was required)',
            source: 'BACKFILL',
            lines: [],
            totalDebit: 0,
            totalCredit: 0,
            isSystemGenerated: true,
            createdById: new mongoose.Types.ObjectId(userId),
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const trial = await accountingService.getTrialBalance();
  const sheet = await accountingService.getBalanceSheet();
  console.log(
    `\n  trial balance: debit ${money(trial.totalDebit)} vs credit ${money(trial.totalCredit)} — ${trial.balanced ? 'balanced' : 'OUT OF BALANCE'}`
  );
  console.log(
    `  balance sheet: assets ${money(sheet.totalAssets)} vs liabilities+equity ${money(sheet.totalLiabilitiesAndEquity)} — ${sheet.balanced ? 'balanced' : 'OUT OF BALANCE'}`
  );
  console.log('\nBackfill applied.\n');

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('BACKFILL FAILED:', e.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
