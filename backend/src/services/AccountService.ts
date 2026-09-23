import mongoose, { Types } from 'mongoose';
import { Account, IAccount } from '../models/Account';
import { AccountTransaction, IAccountTransaction } from '../models/AccountTransaction';
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

  async create(dto: CreateAccountDto): Promise<IAccount> {
    const initialBalance = Number(dto.initialBalance) || 0;
    const account = await Account.create({
      name: dto.name.trim(),
      accountType: dto.accountType,
      accountNumber: dto.accountNumber?.trim() || undefined,
      currentBalance: initialBalance,
    });

    if (initialBalance > 0) {
      await AccountTransaction.create({
        accountId: account._id,
        type: 'CREDIT',
        amount: initialBalance,
        balanceBefore: 0,
        balanceAfter: initialBalance,
        referenceType: 'TRANSFER',
        referenceId: account._id,
        description: 'Initial opening balance',
      });
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

      // 1. Debit Source
      const srcBefore = source.currentBalance;
      const srcAfter = srcBefore - amount;
      source.currentBalance = srcAfter;
      await source.save({ session });

      await AccountTransaction.create(
        [
          {
            accountId: source._id,
            type: 'DEBIT',
            amount,
            balanceBefore: srcBefore,
            balanceAfter: srcAfter,
            referenceType: 'TRANSFER',
            referenceId: dest._id,
            description: `Transfer to ${dest.name}: ${dto.description}`,
          },
        ],
        { session }
      );

      // 2. Credit Destination
      const dstBefore = dest.currentBalance;
      const dstAfter = dstBefore + amount;
      dest.currentBalance = dstAfter;
      await dest.save({ session });

      await AccountTransaction.create(
        [
          {
            accountId: dest._id,
            type: 'CREDIT',
            amount,
            balanceBefore: dstBefore,
            balanceAfter: dstAfter,
            referenceType: 'TRANSFER',
            referenceId: source._id,
            description: `Transfer from ${source.name}: ${dto.description}`,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return { source, dest, amount };
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
