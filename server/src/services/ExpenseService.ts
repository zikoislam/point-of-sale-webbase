import mongoose, { Types } from 'mongoose';
import { Expense, IExpense } from '../models/Expense';
import { ExpenseCategory, IExpenseCategory } from '../models/ExpenseCategory';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { Shift } from '../models/Shift';
import { AppError } from '../utils/app-error';

export interface CreateCategoryDto {
  name: string;
  code: string;
}

export interface CreateExpenseDto {
  categoryId: string;
  amount: number;
  accountId: string;
  description: string;
  receiptVoucherUrl?: string;
}

class ExpenseService {
  async listCategories() {
    return ExpenseCategory.find().sort({ name: 1 }).lean();
  }

  async createCategory(dto: CreateCategoryDto): Promise<IExpenseCategory> {
    const code = dto.code.trim().toUpperCase();
    const existing = await ExpenseCategory.findOne({ code }).lean();
    if (existing) throw new AppError(409, 'DUPLICATE_CODE', 'Expense category code already exists');

    const cat = await ExpenseCategory.create({
      name: dto.name.trim(),
      code,
    });
    return cat.toObject() as unknown as IExpenseCategory;
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>): Promise<IExpenseCategory> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid category ID');
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const dup = await ExpenseCategory.findOne({ code, _id: { $ne: id } }).lean();
      if (dup) throw new AppError(409, 'DUPLICATE_CODE', 'Category code already used by another category');
      dto.code = code;
    }
    const cat = await ExpenseCategory.findByIdAndUpdate(id, { $set: dto }, { new: true }).lean();
    if (!cat) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Expense category not found');
    return cat as unknown as IExpenseCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid category ID');
    const used = await Expense.findOne({ categoryId: id }).lean();
    if (used) throw new AppError(400, 'CATEGORY_IN_USE', 'Cannot delete category that is referenced by expenses');
    const cat = await ExpenseCategory.findByIdAndDelete(id);
    if (!cat) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Expense category not found');
  }

  async listExpenses(page = 1, limit = 20, categoryId?: string, accountId?: string) {
    const query: any = {};
    if (categoryId && Types.ObjectId.isValid(categoryId)) query.categoryId = categoryId;
    if (accountId && Types.ObjectId.isValid(accountId)) query.accountId = accountId;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('categoryId', 'name code')
        .populate('accountId', 'name accountType')
        .populate('createdById', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Expense.countDocuments(query),
    ]);

    return { data: expenses, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createExpense(dto: CreateExpenseDto, userId: string): Promise<IExpense> {
    if (!Types.ObjectId.isValid(dto.categoryId) || !Types.ObjectId.isValid(dto.accountId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid category or account ID');
    }

    const amount = Number(dto.amount);
    if (amount <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Expense amount must be greater than 0');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const account = await Account.findById(dto.accountId).session(session);
      if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Payment account not found');
      if (account.currentBalance < amount) {
        throw new AppError(
          400,
          'INSUFFICIENT_BALANCE',
          `Insufficient balance in ${account.name}. Available: ৳${account.currentBalance.toFixed(2)}`
        );
      }

      const balanceBefore = account.currentBalance;
      const balanceAfter = balanceBefore - amount;
      account.currentBalance = balanceAfter;
      await account.save({ session });

      const expense = await Expense.create(
        [
          {
            categoryId: new Types.ObjectId(dto.categoryId),
            amount,
            accountId: new Types.ObjectId(dto.accountId),
            description: dto.description.trim(),
            receiptVoucherUrl: dto.receiptVoucherUrl?.trim(),
            createdById: new Types.ObjectId(userId),
          },
        ],
        { session }
      );

      await AccountTransaction.create(
        [
          {
            accountId: account._id,
            type: 'DEBIT',
            amount,
            balanceBefore,
            balanceAfter,
            referenceType: 'EXPENSE',
            referenceId: expense[0]._id,
            description: `Expense: ${dto.description}`,
          },
        ],
        { session }
      );

      // If paid from cash account, check active cashier shift to deduct cashExpensesTotal
      if (account.accountType === 'CASH') {
        const activeShift = await Shift.findOne({
          userId: new Types.ObjectId(userId),
          status: 'OPEN',
        }).session(session);

        if (activeShift) {
          activeShift.cashExpensesTotal += amount;
          activeShift.expectedCash = Math.max(0, activeShift.expectedCash - amount);
          await activeShift.save({ session });
        }
      }

      await session.commitTransaction();
      return expense[0].toObject() as unknown as IExpense;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const expenseService = new ExpenseService();
