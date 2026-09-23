import mongoose, { Types } from 'mongoose';
import { Account, IAccount } from '../models/Account';
import { AccountTransaction, IAccountTransaction } from '../models/AccountTransaction';
import { postTransferJournal } from './accounting-postings';
import { accountingService } from './AccountingService';
import { AppError } from '../utils/app-error';

export interface CreateAccountDto {
  name: string;
  accountType: 'CASH' | 'BANK' | 'MFS';
  accountNumber?: string;
  initialBalance?: number;
}

export interface UpdateAccountDto {
  name?: string;
  accountNumber?: string;
  isActive?: boolean;
}

export interface TransferFundsDto {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
}

class AccountService {
  /**
   * Wallets only — the accounts a payment can settle into. The full chart of
   * accounts (income, expense, capital …) is served by the accounting routes.
   *
   * The `accountType` fallback keeps wallets working before the chart has been
   * seeded, when `isCashEquivalent` has not been set on them yet.
   */
  async list() {
    const accounts = await Account.find({
      $or: [{ isCashEquivalent: true }, { accountType: { $in: ['CASH', 'BANK', 'MFS'] } }],
    })
      .sort({ createdAt: 1 })
      .lean();
    return accounts;
  }

  async getById(id: string): Promise<IAccount> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid account ID');
    const account = await Account.findById(id).lean();
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return account as unknown as IAccount;
  }

  async create(dto: CreateAccountDto, userId?: string): Promise<IAccount> {
    const initialBalance = Number(dto.initialBalance) || 0;

    // A new wallet joins the chart of accounts; its opening balance is a voucher.
    const head =
      dto.accountType === 'BANK'
        ? { type: 'ASSET' as const, subType: 'BANK' as const, normalBalance: 'DEBIT' as const, base: 1020 }
        : dto.accountType === 'MFS'
        ? { type: 'ASSET' as const, subType: 'MFS' as const, normalBalance: 'DEBIT' as const, base: 1030 }
        : { type: 'ASSET' as const, subType: 'CASH' as const, normalBalance: 'DEBIT' as const, base: 1010 };

    const taken = new Set((await Account.find({ code: { $regex: `^${head.base}\\d*$` } }).lean()).map((a) => Number(a.code)));
    let code = head.base;
    while (taken.has(code)) code += 1;

    const account = await Account.create({
      name: dto.name.trim(),
      accountType: dto.accountType,
      accountNumber: dto.accountNumber?.trim() || undefined,
      code: String(code),
      type: head.type,
      subType: head.subType,
      normalBalance: head.normalBalance,
      isCashEquivalent: true,
      // The opening voucher below is what sets the balance.
      currentBalance: 0,
    });

    if (initialBalance > 0 && userId) {
      await accountingService.postOpeningVoucher(String(account._id), initialBalance, userId);
      const fresh = await Account.findById(account._id).lean();
      return fresh as unknown as IAccount;
    }

    return account.toObject() as unknown as IAccount;
  }

  async update(id: string, dto: UpdateAccountDto): Promise<IAccount> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid account ID');
    const account = await Account.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true, runValidators: true }
    ).lean();
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return account as unknown as IAccount;
  }

  async transferFunds(dto: TransferFundsDto, userId: string) {
    if (!Types.ObjectId.isValid(dto.fromAccountId) || !Types.ObjectId.isValid(dto.toAccountId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid source or destination account ID');
    }
    if (dto.fromAccountId === dto.toAccountId) {
      throw new AppError(400, 'SAME_ACCOUNT', 'Source and destination accounts must be different');
    }

    const amount = Number(dto.amount);
    if (amount <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Transfer amount must be greater than 0');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const source = await Account.findById(dto.fromAccountId).session(session);
      if (!source) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Source account not found');
      if (!source.isActive) throw new AppError(422, 'ACCOUNT_NOT_ACTIVE', `Source account ${source.name} is inactive`);
      if (source.currentBalance < amount) {
        throw new AppError(
          422,
          'ACCOUNT_INSUFFICIENT_FUNDS',
          `Insufficient balance in ${source.name}. Available: ৳${source.currentBalance.toFixed(2)}`
        );
      }

      const dest = await Account.findById(dto.toAccountId).session(session);
      if (!dest) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Destination account not found');
      if (!dest.isActive) throw new AppError(422, 'ACCOUNT_NOT_ACTIVE', `Destination account ${dest.name} is inactive`);

      const [fromAccount, toAccount] = await Promise.all([
        Account.findById(source._id).session(session).lean(),
        Account.findById(dest._id).session(session).lean(),
      ]);

      if (!fromAccount || !toAccount) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');

      // One balanced voucher — the ledger owns both balances.
      await postTransferJournal({
        fromAccountId: String(source._id),
        toAccountId: String(dest._id),
        fromName: source.name,
        toName: dest.name,
        amount,
        description: dto.description,
        userId,
        session,
      });

      await session.commitTransaction();
      return { source: fromAccount, dest: toAccount, amount };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async getLedger(accountId: string, page = 1, limit = 30) {
    if (!Types.ObjectId.isValid(accountId)) throw new AppError(400, 'INVALID_ID', 'Invalid account ID');
    const [entries, total] = await Promise.all([
      AccountTransaction.find({ accountId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AccountTransaction.countDocuments({ accountId }),
    ]);

    return { data: entries, total, page, totalPages: Math.ceil(total / limit) };
  }
}

export const accountService = new AccountService();
