import { ClientSession, Types } from 'mongoose';
import { Account, IAccount, AccountSubType, AccountType } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { JournalEntry, IJournalEntry, JournalSource } from '../models/JournalEntry';
import { generateJournalNo } from './SequenceService';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';

/** Ledger code of the head each automated event posts to. */
export const HEADS = {
  CASH: '1010',
  BANK: '1020',
  MFS: '1030',
  RECEIVABLE: '1100',
  INVENTORY: '1200',
  PAYABLE: '2010',
  LOAN: '2020',
  VAT_PAYABLE: '2030',
  STORE_CREDIT: '2040',
  CAPITAL: '3010',
  DRAWINGS: '3020',
  RETAINED: '3030',
  OPENING_EQUITY: '3090',
  SALES: '4010',
  SALES_RETURN: '4020',
  OTHER_INCOME: '4090',
  COGS: '5010',
  WASTAGE: '5020',
} as const;

interface ChartHead {
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  isCashEquivalent?: boolean;
  accountType?: 'CASH' | 'BANK' | 'MFS' | 'OTHER';
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
}

/** Cash / bank / MFS rolls carry the seeded wallet, the rest are chart heads. */
export const STANDARD_CHART: ChartHead[] = [
  { code: '1010', name: 'Cash in Hand', type: 'ASSET', subType: 'CASH', isCashEquivalent: true, accountType: 'CASH', normalBalance: 'DEBIT', isSystem: true },
  { code: '1020', name: 'Bank Account', type: 'ASSET', subType: 'BANK', isCashEquivalent: true, accountType: 'BANK', normalBalance: 'DEBIT', isSystem: true },
  { code: '1030', name: 'Mobile Banking (MFS)', type: 'ASSET', subType: 'MFS', isCashEquivalent: true, accountType: 'MFS', normalBalance: 'DEBIT', isSystem: true },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subType: 'RECEIVABLE', normalBalance: 'DEBIT', isSystem: true },
  { code: '1200', name: 'Inventory', type: 'ASSET', subType: 'INVENTORY', normalBalance: 'DEBIT', isSystem: true },
  { code: '1500', name: 'Furniture & Fixtures', type: 'ASSET', subType: 'FIXED_ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1510', name: 'Shop Equipment', type: 'ASSET', subType: 'FIXED_ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', subType: 'PAYABLE', normalBalance: 'CREDIT', isSystem: true },
  { code: '2020', name: 'Loans', type: 'LIABILITY', subType: 'LOAN', normalBalance: 'CREDIT', isSystem: true },
  { code: '2030', name: 'VAT Payable', type: 'LIABILITY', subType: 'TAX', normalBalance: 'CREDIT', isSystem: true },
  { code: '2040', name: 'Store Credit Liability', type: 'LIABILITY', subType: 'STORE_CREDIT', normalBalance: 'CREDIT', isSystem: true },
  { code: '3010', name: 'Capital', type: 'EQUITY', subType: 'CAPITAL', normalBalance: 'CREDIT', isSystem: true },
  { code: '3020', name: "Owner's Drawings", type: 'EQUITY', subType: 'DRAWINGS', normalBalance: 'DEBIT', isSystem: true },
  { code: '3030', name: 'Retained Earnings', type: 'EQUITY', subType: 'RETAINED', normalBalance: 'CREDIT', isSystem: true },
  { code: '3090', name: 'Opening Balance Equity', type: 'EQUITY', subType: 'OPENING_EQUITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '4010', name: 'Sales', type: 'INCOME', subType: 'SALES', normalBalance: 'CREDIT', isSystem: true },
  { code: '4020', name: 'Sales Returns', type: 'INCOME', subType: 'SALES_RETURN', normalBalance: 'DEBIT', isSystem: true },
  { code: '4090', name: 'Other Income', type: 'INCOME', subType: 'OTHER_INCOME', normalBalance: 'CREDIT', isSystem: true },
  { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: 'COGS', normalBalance: 'DEBIT', isSystem: true },
  { code: '5020', name: 'Inventory Shrinkage & Loss', type: 'EXPENSE', subType: 'WASTAGE', normalBalance: 'DEBIT', isSystem: true },
];

/** Mirrors a cash movement into the wallet ledger the Accounts screen reads. */
const REFERENCE_BY_SOURCE: Record<
  JournalSource,
  'SALE' | 'EXPENSE' | 'TRANSFER' | 'DUE_COLLECTION' | 'SUPPLIER_PAYMENT' | 'WASTAGE_LOSS' | 'RETURN' | 'PURCHASE' | 'OPENING' | 'MANUAL' | 'ADJUSTMENT'
> = {
  OPENING: 'OPENING',
  SALE: 'SALE',
  SALE_RETURN: 'RETURN',
  PURCHASE: 'PURCHASE',
  PURCHASE_RETURN: 'PURCHASE',
  EXPENSE: 'EXPENSE',
  WASTAGE: 'WASTAGE_LOSS',
  TRANSFER: 'TRANSFER',
  DUE_COLLECTION: 'DUE_COLLECTION',
  SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
  SHIFT: 'EXPENSE',
  MANUAL: 'MANUAL',
  ADJUSTMENT: 'ADJUSTMENT',
  BACKFILL: 'MANUAL',
};

export interface JournalLineInput {
  accountId?: string;
  accountCode?: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostJournalInput {
  date?: Date | string;
  narration: string;
  source: JournalSource;
  referenceType?: string;
  referenceId?: string | Types.ObjectId;
  lines: JournalLineInput[];
  createdById: string;
  isSystemGenerated?: boolean;
  /** Pass the caller's session so the voucher commits with the document. */
  session?: ClientSession;
}

export interface LedgerRow {
  entryId: string;
  entryNo: string;
  date: Date;
  narration: string;
  source: JournalSource;
  referenceType?: string;
  referenceId?: string;
  memo?: string;
  debit: number;
  credit: number;
  balance: number;
  isReversed: boolean;
}

/** Signed movement for an account, in that account's own natural direction. */
function signedDelta(normalBalance: 'DEBIT' | 'CREDIT', debit: number, credit: number): number {
  return normalBalance === 'DEBIT' ? roundMoney(debit - credit) : roundMoney(credit - debit);
}

class AccountingService {
  // ────────────────────────────────────────────────────────── chart ──

  /** Creates the standard heads and adopts any wallet that predates them. */
  async seedChart(): Promise<{ created: number; adopted: number }> {
    const existing = await Account.find().lean();
    const takenCodes = new Set(existing.map((a) => a.code).filter(Boolean) as string[]);
    let adopted = 0;

    for (const account of existing) {
      const patch: Record<string, any> = {};
      if (!account.code) {
        const base = account.accountType === 'BANK' ? 1020 : account.accountType === 'MFS' ? 1030 : 1010;
        let code = base;
        // 1010 → 1011 → 1012 … so two cash boxes can coexist
        while (takenCodes.has(String(code))) code += 1;
        patch.code = String(code);
        takenCodes.add(patch.code);
      }
      if (!account.isCashEquivalent && account.accountType !== 'OTHER') patch.isCashEquivalent = true;
      if (account.accountType === 'BANK' || account.accountType === 'MFS' || account.accountType === 'CASH') {
        patch.type = 'ASSET';
        patch.subType = account.accountType === 'BANK' ? 'BANK' : account.accountType === 'MFS' ? 'MFS' : 'CASH';
        patch.normalBalance = 'DEBIT';
      }
      if (Object.keys(patch).length) {
        await Account.updateOne({ _id: account._id }, { $set: patch });
        adopted++;
      }
    }

    let created = 0;
    for (const head of STANDARD_CHART) {
      if (takenCodes.has(head.code)) continue;
      const exists = await Account.findOne({ code: head.code }).lean();
      if (exists) continue;
      await Account.create({
        code: head.code,
        name: head.name,
        type: head.type,
        subType: head.subType,
        accountType: head.accountType || 'OTHER',
        isCashEquivalent: !!head.isCashEquivalent,
        isSystem: true,
        normalBalance: head.normalBalance,
      });
      takenCodes.add(head.code);
      created++;
    }

    return { created, adopted };
  }

  /** Every head, ordered by code, with its balance and whether it is a wallet. */
  async listChart() {
    const accounts = await Account.find().sort({ code: 1, name: 1 }).lean();
    return accounts.map((a) => ({
      ...a,
      isCashEquivalent: !!a.isCashEquivalent,
      displayBalance: roundMoney(a.currentBalance || 0),
    }));
  }

  /** Look up heads by code — used by every posting helper. */
  async headsByCode(): Promise<Record<string, IAccount>> {
    const accounts = await Account.find({ code: { $in: Object.values(HEADS) } }).lean();
    const map: Record<string, IAccount> = {};
    for (const a of accounts) if (a.code) map[a.code] = a as unknown as IAccount;
    for (const code of Object.values(HEADS)) {
      if (!map[code]) throw new AppError(500, 'CHART_INCOMPLETE', `Chart of accounts is missing head ${code}. Run the chart seed.`);
    }
    return map;
  }

  // ─────────────────────────────────────────────────────── posting ──

  /**
   * The single way money enters the books.
   *
   * Validates that the voucher balances, writes the entry, moves each head's
   * cached balance, and mirrors the movement into the wallet ledger for
   * cash-equivalent heads.
   */
  async postJournal(input: PostJournalInput): Promise<IJournalEntry> {
    const { session } = input;

    if (!input.lines || input.lines.length < 2) {
      throw new AppError(400, 'JOURNAL_TOO_SHORT', 'A journal voucher needs at least two lines');
    }
    if (!Types.ObjectId.isValid(input.createdById)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid user id for the posting');
    }

    // ---- resolve heads -------------------------------------------------
    const ids = input.lines.map((l) => l.accountId).filter((v): v is string => !!v && Types.ObjectId.isValid(v));
    const codes = input.lines.map((l) => l.accountCode).filter((v): v is string => !!v);
    const [byId, byCode] = await Promise.all([
      ids.length ? Account.find({ _id: { $in: ids } }).lean() : Promise.resolve([]),
      codes.length ? Account.find({ code: { $in: codes } }).lean() : Promise.resolve([]),
    ]);
    const idMap = new Map(byId.map((a) => [String(a._id), a as unknown as IAccount]));
    const codeMap = new Map(byCode.map((a) => [a.code as string, a as unknown as IAccount]));

    const resolved = input.lines.map((l) => {
      const account = l.accountId
        ? idMap.get(String(l.accountId))
        : l.accountCode
        ? codeMap.get(l.accountCode)
        : undefined;
      if (!account) {
        throw new AppError(400, 'ACCOUNT_NOT_FOUND', `Account not found for line: ${l.accountId || l.accountCode}`);
      }
      if (!account.isActive) {
        throw new AppError(422, 'ACCOUNT_NOT_ACTIVE', `Account ${account.name} is inactive`);
      }
      const debit = roundMoney(Number(l.debit) || 0);
      const credit = roundMoney(Number(l.credit) || 0);
      if (debit < 0 || credit < 0) throw new AppError(400, 'JOURNAL_NEGATIVE', 'Journal amounts cannot be negative');
      if (debit === 0 && credit === 0) throw new AppError(400, 'JOURNAL_EMPTY_LINE', 'Every line needs a debit or a credit');
      if (debit > 0 && credit > 0) throw new AppError(400, 'JOURNAL_BOTH_SIDES', 'A line cannot be both a debit and a credit');
      return { account, debit, credit, memo: l.memo?.trim() };
    });

    const totalDebit = roundMoney(resolved.reduce((n, l) => n + l.debit, 0));
    const totalCredit = roundMoney(resolved.reduce((n, l) => n + l.credit, 0));
    if (totalDebit === 0) throw new AppError(400, 'JOURNAL_EMPTY', 'A journal voucher cannot be for zero');
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new AppError(
        400,
        'JOURNAL_UNBALANCED',
        `Voucher does not balance — debit ${totalDebit.toFixed(2)} vs credit ${totalCredit.toFixed(2)}`
      );
    }

    // ---- write the voucher --------------------------------------------
    const entryNo = await generateJournalNo(session);
    const date = input.date ? new Date(input.date) : new Date();

    const created = await JournalEntry.create(
      [
        {
          entryNo,
          date,
          narration: input.narration.trim(),
          source: input.source,
          referenceType: input.referenceType,
          referenceId:
            input.referenceId && Types.ObjectId.isValid(String(input.referenceId))
              ? new Types.ObjectId(String(input.referenceId))
              : undefined,
          lines: resolved.map((l) => ({
            accountId: l.account._id,
            accountCode: l.account.code || '',
            accountName: l.account.name,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo,
          })),
          totalDebit,
          totalCredit,
          isSystemGenerated: !!input.isSystemGenerated,
          createdById: new Types.ObjectId(input.createdById),
          postedAt: new Date(),
        },
      ],
      { session }
    );

    const entry = created[0];

    // ---- move the balances + mirror cash into the wallet ledger --------
    for (const l of resolved) {
      const delta = signedDelta(l.account.normalBalance, l.debit, l.credit);
      const before = roundMoney(l.account.currentBalance || 0);
      const after = roundMoney(before + delta);

      await Account.updateOne({ _id: l.account._id }, { $set: { currentBalance: after } }, { session });

      if (l.account.isCashEquivalent && Math.abs(delta) > 0.005) {
        await AccountTransaction.create(
          [
            {
              accountId: l.account._id,
              type: delta > 0 ? 'CREDIT' : 'DEBIT',
              amount: Math.abs(delta),
              balanceBefore: before,
              balanceAfter: after,
              referenceType: REFERENCE_BY_SOURCE[input.source],
              referenceId: (input.referenceId && Types.ObjectId.isValid(String(input.referenceId))
                ? new Types.ObjectId(String(input.referenceId))
                : entry._id) as Types.ObjectId,
              description: input.narration.trim().slice(0, 250),
            },
          ],
          { session }
        );
      }
    }

    return entry.toObject() as unknown as IJournalEntry;
  }

  /** Vouchers are never edited — a wrong one is mirrored and marked reversed. */
  async reverseEntry(entryId: string, userId: string): Promise<IJournalEntry> {
    if (!Types.ObjectId.isValid(entryId)) throw new AppError(400, 'INVALID_ID', 'Invalid journal id');
    const original = await JournalEntry.findById(entryId).lean();
    if (!original) throw new AppError(404, 'JOURNAL_NOT_FOUND', 'Journal voucher not found');
    if (original.isReversed) throw new AppError(409, 'JOURNAL_ALREADY_REVERSED', 'This voucher has already been reversed');

    const mirror = await this.postJournal({
      date: new Date(),
      narration: `Reversal of ${original.entryNo} — ${original.narration}`.slice(0, 250),
      source: original.source,
      referenceType: original.referenceType,
      referenceId: original.referenceId,
      createdById: userId,
      isSystemGenerated: true,
      lines: original.lines.map((l) => ({
        accountId: String(l.accountId),
        debit: l.credit,
        credit: l.debit,
        memo: l.memo,
      })),
    });

    await JournalEntry.updateOne({ _id: entryId }, { $set: { isReversed: true, reversedBy: mirror._id } });
    await JournalEntry.updateOne({ _id: mirror._id }, { $set: { reversalOf: original._id } });

    return mirror;
  }

  /** Books a head's brought-forward balance; contra is Opening Balance Equity. */
  async postOpeningVoucher(accountId: string, amount: number, userId: string, date?: Date | string): Promise<IJournalEntry> {
    const account = await Account.findById(accountId).lean();
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');

    const value = roundMoney(Math.abs(Number(amount) || 0));
    if (value <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Opening balance must be greater than zero');

    const debitFirst = account.normalBalance === 'DEBIT';
    return this.postJournal({
      date: date || new Date(),
      narration: `Opening balance — ${account.name}`,
      source: 'OPENING',
      referenceType: 'ACCOUNT',
      referenceId: account._id,
      createdById: userId,
      isSystemGenerated: true,
      lines: [
        debitFirst ? { accountId: String(account._id), debit: value } : { accountId: String(account._id), credit: value },
        debitFirst ? { accountCode: HEADS.OPENING_EQUITY, credit: value } : { accountCode: HEADS.OPENING_EQUITY, debit: value },
      ],
    });
  }

  // ───────────────────────────────────────────────────────── reading ──

  async getDayBook(opts: {
    from?: string;
    to?: string;
    source?: string;
    accountId?: string;
    referenceId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 50, 200);

    const query: any = {};
    if (opts.from || opts.to) {
      query.date = {};
      if (opts.from) query.date.$gte = new Date(opts.from);
      if (opts.to) query.date.$lte = new Date(`${opts.to}T23:59:59.999Z`);
    }
    if (opts.source) query.source = opts.source;
    if (opts.accountId && Types.ObjectId.isValid(opts.accountId)) query['lines.accountId'] = new Types.ObjectId(opts.accountId);
    if (opts.referenceId && Types.ObjectId.isValid(opts.referenceId)) query.referenceId = new Types.ObjectId(opts.referenceId);

    const [entries, total] = await Promise.all([
      JournalEntry.find(query).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      JournalEntry.countDocuments(query),
    ]);

    return { data: entries, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Per-head ledger with opening balance, running balance and closing. */
  async getLedger(accountId: string, opts: { from?: string; to?: string; limit?: number } = {}) {
    if (!Types.ObjectId.isValid(accountId)) throw new AppError(400, 'INVALID_ID', 'Invalid account id');
    const account = await Account.findById(accountId).lean();
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');

    const from = opts.from ? new Date(opts.from) : new Date('1970-01-01');
    const to = opts.to ? new Date(`${opts.to}T23:59:59.999Z`) : new Date('2999-12-31');
    const oid = new Types.ObjectId(accountId);

    const [openingAgg] = await JournalEntry.aggregate([
      { $match: { 'lines.accountId': oid, date: { $lt: from } } },
      { $unwind: '$lines' },
      { $match: { 'lines.accountId': oid } },
      { $group: { _id: null, debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' } } },
    ]);
    const opening = signedDelta(account.normalBalance, openingAgg?.debit || 0, openingAgg?.credit || 0);

    const entries = await JournalEntry.find({ 'lines.accountId': oid, date: { $gte: from, $lte: to } })
      .sort({ date: 1, createdAt: 1 })
      .limit(Math.min(opts.limit || 500, 2000))
      .lean();

    let running = opening;
    const rows: LedgerRow[] = [];
    for (const entry of entries) {
      for (const l of entry.lines) {
        if (String(l.accountId) !== accountId) continue;
        running = roundMoney(running + signedDelta(account.normalBalance, l.debit, l.credit));
        rows.push({
          entryId: String(entry._id),
          entryNo: entry.entryNo,
          date: entry.date,
          narration: entry.narration,
          source: entry.source,
          referenceType: entry.referenceType,
          referenceId: entry.referenceId ? String(entry.referenceId) : undefined,
          memo: l.memo,
          debit: l.debit,
          credit: l.credit,
          balance: running,
          isReversed: !!entry.isReversed,
        });
      }
    }

    return {
      account: {
        _id: String(account._id),
        code: account.code,
        name: account.name,
        type: account.type,
        subType: account.subType,
        normalBalance: account.normalBalance,
        currentBalance: roundMoney(account.currentBalance || 0),
      },
      opening: roundMoney(opening),
      closing: roundMoney(running),
      data: rows,
    };
  }

  /** Raw debit/credit totals per head over a period — the base for the statements. */
  private async totalsByHead(opts: { from?: Date; to?: Date }) {
    const match: any = {};
    if (opts.from || opts.to) {
      match.date = {};
      if (opts.from) match.date.$gte = opts.from;
      if (opts.to) match.date.$lte = opts.to;
    }

    const rows: Array<{ _id: Types.ObjectId; debit: number; credit: number }> = await JournalEntry.aggregate([
      { $match: match },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.accountId', debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' } } },
    ]);

    const accounts = await Account.find().sort({ code: 1 }).lean();
    return accounts.map((a) => {
      const row = rows.find((r) => String(r._id) === String(a._id));
      const debit = roundMoney(row?.debit || 0);
      const credit = roundMoney(row?.credit || 0);
      return { account: a as unknown as IAccount, debit, credit, balance: signedDelta(a.normalBalance, debit, credit) };
    });
  }

  private periodBounds(from?: string, to?: string) {
    return {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    };
  }

  async getTrialBalance(from?: string, to?: string) {
    const bounds = this.periodBounds(from, to);
    const heads = await this.totalsByHead(bounds);

    const rows = heads
      .filter((h) => h.debit !== 0 || h.credit !== 0)
      .map((h) => ({
        accountId: String(h.account._id),
        code: h.account.code,
        name: h.account.name,
        type: h.account.type,
        normalBalance: h.account.normalBalance,
        debit: h.account.normalBalance === 'DEBIT' ? (h.balance > 0 ? h.balance : 0) : h.balance < 0 ? -h.balance : 0,
        credit: h.account.normalBalance === 'CREDIT' ? (h.balance > 0 ? h.balance : 0) : h.balance < 0 ? -h.balance : 0,
        turnoverDebit: h.debit,
        turnoverCredit: h.credit,
      }));

    const totalDebit = roundMoney(rows.reduce((n, r) => n + r.debit, 0));
    const totalCredit = roundMoney(rows.reduce((n, r) => n + r.credit, 0));

    return { from: from || null, to: to || null, rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }

  async getProfitAndLoss(from?: string, to?: string) {
    const bounds = this.periodBounds(from, to);
    const heads = await this.totalsByHead(bounds);

    const income = heads
      .filter((h) => h.account.type === 'INCOME')
      .map((h) => ({ code: h.account.code, name: h.account.name, subType: h.account.subType, amount: h.balance }));
    const expenses = heads
      .filter((h) => h.account.type === 'EXPENSE')
      .map((h) => ({ code: h.account.code, name: h.account.name, subType: h.account.subType, amount: h.balance }));

    const totalIncome = roundMoney(income.reduce((n, r) => n + r.amount, 0));
    const totalExpense = roundMoney(expenses.reduce((n, r) => n + r.amount, 0));
    const directCosts = roundMoney(
      expenses.filter((e) => e.subType === 'COGS' || e.subType === 'WASTAGE').reduce((n, r) => n + r.amount, 0)
    );

    return {
      from: from || null,
      to: to || null,
      income,
      expenses,
      totalIncome,
      totalExpense,
      netProfit: roundMoney(totalIncome - totalExpense),
      cogs: roundMoney(expenses.filter((e) => e.subType === 'COGS').reduce((n, r) => n + r.amount, 0)),
      grossProfit: roundMoney(totalIncome - directCosts),
    };
  }

  async getBalanceSheet(asOf?: string) {
    const bounds = { from: undefined, to: asOf ? new Date(`${asOf}T23:59:59.999Z`) : undefined };
    const heads = await this.totalsByHead(bounds);

    const pick = (type: string) =>
      heads
        .filter((h) => h.account.type === type)
        .map((h) => ({ code: h.account.code, name: h.account.name, subType: h.account.subType, amount: h.balance }))
        .filter((r) => r.amount !== 0);

    const assets = pick('ASSET');
    const liabilities = pick('LIABILITY');
    const equity = pick('EQUITY');

    const totalAssets = roundMoney(assets.reduce((n, r) => n + r.amount, 0));
    const totalLiabilities = roundMoney(liabilities.reduce((n, r) => n + r.amount, 0));
    const totalEquity = roundMoney(equity.reduce((n, r) => n + r.amount, 0));

    // Income − expense belongs to the owner until the year is closed into Retained Earnings.
    const income = roundMoney(heads.filter((h) => h.account.type === 'INCOME').reduce((n, h) => n + h.balance, 0));
    const expense = roundMoney(heads.filter((h) => h.account.type === 'EXPENSE').reduce((n, h) => n + h.balance, 0));
    const netProfit = roundMoney(income - expense);

    return {
      asOf: asOf || null,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      netProfit,
      totalLiabilitiesAndEquity: roundMoney(totalLiabilities + totalEquity + netProfit),
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netProfit)) < 0.01,
    };
  }

  async getCashFlow(from?: string, to?: string) {
    const bounds = this.periodBounds(from, to);
    const wallets = await Account.find({ isCashEquivalent: true }).lean();
    const walletIds = new Set(wallets.map((w) => String(w._id)));

    const match: any = {};
    if (bounds.from || bounds.to) {
      match.date = {};
      if (bounds.from) match.date.$gte = bounds.from;
      if (bounds.to) match.date.$lte = bounds.to;
    }
    const entries = await JournalEntry.find(match).sort({ date: 1 }).lean();

    const opening = wallets.reduce((n, w) => n + roundMoney(w.currentBalance || 0), 0);
    const lines: Array<{ date: Date; entryNo: string; narration: string; source: string; amount: number; direction: 'IN' | 'OUT' }> = [];
    const bySource: Record<string, { in: number; out: number }> = {};

    for (const entry of entries) {
      let net = 0;
      for (const l of entry.lines) {
        if (!walletIds.has(String(l.accountId))) continue;
        net = roundMoney(net + l.debit - l.credit);
      }
      if (Math.abs(net) < 0.005) continue;

      lines.push({
        date: entry.date,
        entryNo: entry.entryNo,
        narration: entry.narration,
        source: entry.source,
        amount: Math.abs(net),
        direction: net > 0 ? 'IN' : 'OUT',
      });

      bySource[entry.source] = bySource[entry.source] || { in: 0, out: 0 };
      if (net > 0) bySource[entry.source].in = roundMoney(bySource[entry.source].in + net);
      else bySource[entry.source].out = roundMoney(bySource[entry.source].out + Math.abs(net));
    }

    const totalIn = roundMoney(lines.filter((l) => l.direction === 'IN').reduce((n, l) => n + l.amount, 0));
    const totalOut = roundMoney(lines.filter((l) => l.direction === 'OUT').reduce((n, l) => n + l.amount, 0));

    return {
      from: from || null,
      to: to || null,
      wallets: wallets.map((w) => ({ _id: String(w._id), name: w.name, balance: roundMoney(w.currentBalance || 0) })),
      bySource: Object.entries(bySource).map(([source, v]) => ({ source, in: v.in, out: v.out, net: roundMoney(v.in - v.out) })),
      lines,
      totalIn,
      totalOut,
      netChange: roundMoney(totalIn - totalOut),
      opening,
      closing: roundMoney(opening + totalIn - totalOut),
    };
  }
}

export const accountingService = new AccountingService();
