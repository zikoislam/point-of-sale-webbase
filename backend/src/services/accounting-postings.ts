import { ClientSession, Types } from 'mongoose';
import { Account } from '../models/Account';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { accountingService, HEADS, JournalLineInput } from './AccountingService';
import { roundMoney } from '../utils/helpers';

/**
 * Turns business documents into balanced vouchers.
 *
 * These builders are the only place that knows the debit/credit shape of a sale
 * or a purchase — the ledger itself stays generic. Call them inside the caller's
 * Mongo session so the document and the books commit together.
 */

const line = (accountId: string, debit: number, credit: number, memo?: string): JournalLineInput => ({
  accountId,
  debit,
  credit,
  memo,
});

/** Wallet a payment settles into when the caller did not name one. */
export async function defaultWalletFor(method: string): Promise<string> {
  const code = method === 'CARD' ? HEADS.BANK : method.startsWith('MFS') ? HEADS.MFS : HEADS.CASH;
  const account = await Account.findOne({ code }).lean();
  if (!account) {
    const anyCash = await Account.findOne({ isCashEquivalent: true }).sort({ code: 1 }).lean();
    if (!anyCash) throw new Error('No cash-equivalent account exists to post against');
    return String(anyCash._id);
  }
  return String(account._id);
}

export interface PostResult {
  posted: boolean;
  entryNo?: string;
}

/**
 * The sale's own lines come from documents that already net to the bill total;
 * if rounding leaves a gap the difference lands in Sales so the voucher still
 * balances instead of being dropped. COGS rides along on the same voucher.
 */
function balanceSaleVoucher(lines: JournalLineInput[], cogs: number): JournalLineInput[] | null {
  const debit = roundMoney(lines.reduce((n, l) => n + (Number(l.debit) || 0), 0));
  const credit = roundMoney(lines.reduce((n, l) => n + (Number(l.credit) || 0), 0));
  const diff = roundMoney(debit - credit);

  if (Math.abs(diff) > 0.005) {
    if (diff > 0) lines.push({ accountCode: HEADS.SALES, credit: diff, memo: 'Rounding' });
    else lines.push({ accountCode: HEADS.SALES, debit: -diff, memo: 'Rounding' });
  }

  if (cogs > 0) {
    lines.push({ accountCode: HEADS.COGS, debit: cogs, memo: 'Cost of goods sold' });
    lines.push({ accountCode: HEADS.INVENTORY, credit: cogs });
  }

  const totalDebit = roundMoney(lines.reduce((n, l) => n + (Number(l.debit) || 0), 0));
  const totalCredit = roundMoney(lines.reduce((n, l) => n + (Number(l.credit) || 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.005 || totalDebit === 0) return null;
  return lines;
}

/** Revenue, VAT, COGS and every payment line of a POS sale. */
export async function postSaleJournals(sale: any, userId: string, session?: ClientSession): Promise<PostResult> {
  const lines: JournalLineInput[] = [];

  const totalTax = roundMoney(Number(sale.totalTax) || 0);
  const totalAmount = roundMoney(Number(sale.totalAmount) || 0);
  const revenue = roundMoney(totalAmount - totalTax);

  const payments: any[] = Array.isArray(sale.payments) ? sale.payments : [];
  for (const payment of payments) {
    const amount = roundMoney(Number(payment.amount) || 0);
    if (amount <= 0 || payment.method === 'CUSTOMER_DUE') continue;

    if (payment.method === 'STORE_CREDIT') {
      lines.push({ accountCode: HEADS.STORE_CREDIT, debit: amount, memo: 'Voucher redeemed' });
      continue;
    }
    const accountId =
      payment.accountId && Types.ObjectId.isValid(String(payment.accountId))
        ? String(payment.accountId)
        : await defaultWalletFor(payment.method);
    lines.push(line(accountId, amount, 0, `Payment · ${payment.method}`));
  }

  // A due can exist without an explicit CUSTOMER_DUE payment line.
  const dueFromLines = roundMoney(
    payments.filter((p) => p.method === 'CUSTOMER_DUE').reduce((n, p) => n + (Number(p.amount) || 0), 0)
  );
  const due = roundMoney(Number(sale.dueAmount) || 0) || dueFromLines;
  if (due > 0 && sale.customerId) {
    lines.push({ accountCode: HEADS.RECEIVABLE, debit: due, memo: `Credit sale · ${sale.invoiceNo || ''}` });
  }

  if (revenue !== 0) lines.push({ accountCode: HEADS.SALES, credit: revenue, memo: sale.invoiceNo });
  if (totalTax !== 0) lines.push({ accountCode: HEADS.VAT_PAYABLE, credit: totalTax, memo: 'VAT on sale' });

  const items: any[] = Array.isArray(sale.items) ? sale.items : [];
  const cogs = roundMoney(items.reduce((n, item) => n + (Number(item.quantity) || 0) * (Number(item.unitCostPrice) || 0), 0));

  if (lines.length < 1) return { posted: false };
  const balanced = balanceSaleVoucher(lines, cogs);
  if (!balanced) return { posted: false };

  const entry = await accountingService.postJournal({
    date: sale.createdAt || new Date(),
    narration: `Sale ${sale.invoiceNo || ''}`.trim(),
    source: 'SALE',
    referenceType: 'SALE',
    referenceId: sale._id,
    createdById: userId,
    session,
    lines: balanced,
  });
  return { posted: true, entryNo: entry.entryNo };
}

/**
 * Chart head for an expense category — created on first use, then reused.
 * The owner can re-point a category at another head by setting its accountId.
 */
export async function resolveExpenseHead(category: any, session?: ClientSession): Promise<string> {
  if (category?.accountId && Types.ObjectId.isValid(String(category.accountId))) {
    const existing = await Account.findById(category.accountId).lean();
    if (existing) return String(existing._id);
  }

  const name = String(category?.name || 'Other Expense').trim();
  const found = await Account.findOne({ type: 'EXPENSE', name }).lean();

  let headId: string;
  if (found) {
    headId = String(found._id);
  } else {
    // Next free code in the operating range; 5010/5020 belong to COGS/wastage.
    const used = new Set(
      (await Account.find({ code: { $regex: '^51\\d\\d$' } }).lean()).map((a) => Number(a.code))
    );
    let code = 5100;
    while (used.has(code)) code += 1;

    const created = await Account.create(
      [{ code: String(code), name, type: 'EXPENSE', subType: 'OPERATING', normalBalance: 'DEBIT', isSystem: false }],
      { session }
    );
    headId = String(created[0]._id);
  }

  if (category?._id) {
    await ExpenseCategory.updateOne(
      { _id: category._id },
      { $set: { accountId: new Types.ObjectId(headId) } },
      { session }
    );
  }
  return headId;
}

/** The expense head debited, the paying wallet credited. */
export async function postExpenseJournal(
  expense: any,
  category: any,
  userId: string,
  session?: ClientSession
): Promise<PostResult> {
  const amount = roundMoney(Number(expense.amount) || 0);
  if (amount <= 0) return { posted: false };

  const accountId = await resolveExpenseHead(category, session);

  const entry = await accountingService.postJournal({
    date: expense.createdAt || new Date(),
    narration: `Expense — ${expense.description || ''}`.trim().slice(0, 250),
    source: 'EXPENSE',
    referenceType: 'EXPENSE',
    referenceId: expense._id,
    createdById: userId,
    session,
    lines: [
      line(accountId, amount, 0, expense.description),
      line(String(expense.accountId), 0, amount, 'Paid'),
    ],
  });
  return { posted: true, entryNo: entry.entryNo };
}

/** A customer pays down their due. */
export async function postDueCollectionJournal(opts: {
  customerName: string;
  amount: number;
  walletAccountId: string;
  date?: Date;
  referenceId?: any;
  userId: string;
  session?: ClientSession;
}): Promise<PostResult> {
  const amount = roundMoney(opts.amount);
  if (amount <= 0) return { posted: false };

  const entry = await accountingService.postJournal({
    date: opts.date || new Date(),
    narration: `Due collection — ${opts.customerName}`,
    source: 'DUE_COLLECTION',
    referenceType: 'CUSTOMER_LEDGER',
    referenceId: opts.referenceId,
    createdById: opts.userId,
    session: opts.session,
    lines: [
      line(opts.walletAccountId, amount, 0, 'Received'),
      { accountCode: HEADS.RECEIVABLE, credit: amount, memo: opts.customerName },
    ],
  });
  return { posted: true, entryNo: entry.entryNo };
}

/** Money moved between two wallets. */
export async function postTransferJournal(opts: {
  fromAccountId: string;
  toAccountId: string;
  fromName: string;
  toName: string;
  amount: number;
  description: string;
  userId: string;
  session?: ClientSession;
}): Promise<PostResult> {
  const amount = roundMoney(opts.amount);
  if (amount <= 0) return { posted: false };

  const entry = await accountingService.postJournal({
    date: new Date(),
    narration: `Transfer ${opts.fromName} → ${opts.toName}: ${opts.description}`.slice(0, 250),
    source: 'TRANSFER',
    referenceType: 'TRANSFER',
    createdById: opts.userId,
    session: opts.session,
    lines: [
      line(opts.toAccountId, amount, 0, `From ${opts.fromName}`),
      line(opts.fromAccountId, 0, amount, `To ${opts.toName}`),
    ],
  });
  return { posted: true, entryNo: entry.entryNo };
}

/** Goods received against a purchase order — stock up, supplier owed. */
export async function postPurchaseReceiveJournal(opts: {
  amount: number;
  supplierName: string;
  poNumber: string;
  date?: Date;
  referenceId?: any;
  userId: string;
  session?: ClientSession;
}): Promise<PostResult> {
  const amount = roundMoney(opts.amount);
  if (amount <= 0) return { posted: false };

  const entry = await accountingService.postJournal({
    date: opts.date || new Date(),
    narration: `Purchase received ${opts.poNumber} — ${opts.supplierName}`,
    source: 'PURCHASE',
    referenceType: 'PURCHASE_ORDER',
    referenceId: opts.referenceId,
    createdById: opts.userId,
    session: opts.session,
    lines: [
      { accountCode: HEADS.INVENTORY, debit: amount, memo: opts.poNumber },
      { accountCode: HEADS.PAYABLE, credit: amount, memo: opts.supplierName },
    ],
  });
  return { posted: true, entryNo: entry.entryNo };
}

/** Paying a supplier down. */
export async function postSupplierPaymentJournal(opts: {
  amount: number;
  supplierName: string;
  walletAccountId: string;
  date?: Date;
  referenceId?: any;
  userId: string;
  session?: ClientSession;
}): Promise<PostResult> {
  const amount = roundMoney(opts.amount);
  if (amount <= 0) return { posted: false };

  const entry = await accountingService.postJournal({
    date: opts.date || new Date(),
    narration: `Supplier payment — ${opts.supplierName}`,
    source: 'SUPPLIER_PAYMENT',
    referenceType: 'SUPPLIER_PAYMENT',
    referenceId: opts.referenceId,
    createdById: opts.userId,
    session: opts.session,
    lines: [
      { accountCode: HEADS.PAYABLE, debit: amount, memo: opts.supplierName },
      line(opts.walletAccountId, 0, amount, 'Paid'),
    ],
  });
  return { posted: true, entryNo: entry.entryNo };
}

/** Stock written off — a loss against inventory. */
export async function postWastageJournal(opts: {
  amount: number;
  note: string;
  date?: Date;
  referenceId?: any;
  userId: string;
  session?: ClientSession;
}): Promise<PostResult> {
  const amount = roundMoney(opts.amount);
  if (amount <= 0) return { posted: false };

  const entry = await accountingService.postJournal({
    date: opts.date || new Date(),
    narration: `Wastage — ${opts.note}`.slice(0, 250),
    source: 'WASTAGE',
    referenceType: 'WASTAGE_EXPENSE',
    referenceId: opts.referenceId,
    createdById: opts.userId,
    session: opts.session,
    lines: [
      { accountCode: HEADS.WASTAGE, debit: amount, memo: opts.note },
      { accountCode: HEADS.INVENTORY, credit: amount },
    ],
  });
  return { posted: true, entryNo: entry.entryNo };
}

/** A refund leaving the till (or store credit), plus any restocked goods. */
export async function postSalesReturnJournal(opts: {
  refundAmount: number;
  refundType: string;
  returnNo: string;
  restockValue: number;
  walletAccountId?: string;
  date?: Date;
  referenceId?: any;
  userId: string;
  session?: ClientSession;
}): Promise<PostResult> {
  const refund = roundMoney(opts.refundAmount);
  if (refund <= 0 && opts.restockValue <= 0) return { posted: false };

  const lines: JournalLineInput[] = [];
  if (refund > 0) {
    lines.push({ accountCode: HEADS.SALES_RETURN, debit: refund, memo: opts.returnNo });
    if (opts.refundType === 'STORE_CREDIT') {
      lines.push({ accountCode: HEADS.STORE_CREDIT, credit: refund, memo: 'Voucher issued' });
    } else {
      const wallet = opts.walletAccountId || (await defaultWalletFor('CASH'));
      lines.push(line(wallet, 0, refund, 'Refund paid'));
    }
  }
  if (opts.restockValue > 0) {
    lines.push({ accountCode: HEADS.INVENTORY, debit: opts.restockValue, memo: 'Restocked' });
    lines.push({ accountCode: HEADS.COGS, credit: opts.restockValue });
  }

  const debit = roundMoney(lines.reduce((n, l) => n + (Number(l.debit) || 0), 0));
  const credit = roundMoney(lines.reduce((n, l) => n + (Number(l.credit) || 0), 0));
  if (Math.abs(debit - credit) > 0.005 || lines.length < 2) return { posted: false };

  const entry = await accountingService.postJournal({
    date: opts.date || new Date(),
    narration: `Sales return ${opts.returnNo}`,
    source: 'SALE_RETURN',
    referenceType: 'RETURN',
    referenceId: opts.referenceId,
    createdById: opts.userId,
    session: opts.session,
    lines,
  });
  return { posted: true, entryNo: entry.entryNo };
}
