import mongoose, { Types } from 'mongoose';
import { Supplier } from '../models/Supplier';
import { SupplierLedger } from '../models/SupplierLedger';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { Shift } from '../models/Shift';
import { AppError } from '../utils/app-error';

export interface SupplierDuePaymentDto {
  amount: number;
  accountId: string;
  notes?: string;
}

export interface SupplierItem {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  currentPayableBalance: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateSupplierDto {
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdateSupplierDto {
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

function toItem(doc: any): SupplierItem {
  return {
    id: doc._id.toString(),
    companyName: doc.companyName,
    contactPerson: doc.contactPerson,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    currentPayableBalance: doc.currentPayableBalance,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

class SupplierService {
  async list(page = 1, limit = 50, search?: string, activeOnly = false) {
    const query: any = {};
    if (activeOnly) query.isActive = true;
    if (search) query.$or = [
      { companyName: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];

    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort({ companyName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Supplier.countDocuments(query),
    ]);

    return {
      data: suppliers.map(toItem),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string): Promise<SupplierItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid supplier ID');
    const supplier = await Supplier.findById(id).lean();
    if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    return toItem(supplier);
  }

  async create(dto: CreateSupplierDto): Promise<SupplierItem> {
    const existing = await Supplier.findOne({ phone: dto.phone }).lean();
    if (existing) throw new AppError(409, 'DUPLICATE_PHONE', 'A supplier with this phone already exists');

    const supplier = await Supplier.create({
      companyName: dto.companyName,
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
    });
    return toItem(supplier.toObject());
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid supplier ID');

    if (dto.phone) {
      const dup = await Supplier.findOne({ phone: dto.phone, _id: { $ne: id } }).lean();
      if (dup) throw new AppError(409, 'DUPLICATE_PHONE', 'Phone number already used by another supplier');
    }

    const supplier = await Supplier.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true, runValidators: true }
    ).lean();

    if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    return toItem(supplier);
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid supplier ID');
    const supplier = await Supplier.findById(id).lean();
    if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    if (supplier.currentPayableBalance > 0) {
      throw new AppError(400, 'HAS_BALANCE', 'Cannot delete supplier with outstanding payable balance');
    }
    await Supplier.findByIdAndDelete(id);
  }

  async getLedger(supplierId: string, page = 1, limit = 30) {
    if (!Types.ObjectId.isValid(supplierId)) throw new AppError(400, 'INVALID_ID', 'Invalid supplier ID');
    const [entries, total] = await Promise.all([
      SupplierLedger.find({ supplierId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupplierLedger.countDocuments({ supplierId }),
    ]);
    return { data: entries, total, page, totalPages: Math.ceil(total / limit) };
  }

  async payDue(supplierId: string, dto: SupplierDuePaymentDto, recordedById: string) {
    if (!Types.ObjectId.isValid(supplierId)) throw new AppError(400, 'INVALID_ID', 'Invalid supplier ID');
    if (!Types.ObjectId.isValid(dto.accountId)) throw new AppError(400, 'INVALID_ID', 'Invalid payment account ID');

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');

    const amount = Number(dto.amount);
    if (amount <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be greater than 0');
    if (amount > supplier.currentPayableBalance) {
      throw new AppError(
        400,
        'OVERPAYMENT',
        `Amount exceeds current payable balance of ৳${supplier.currentPayableBalance.toFixed(2)}`
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const account = await Account.findById(dto.accountId).session(session);
      if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Payment account not found');
      if (account.currentBalance < amount) {
        throw new AppError(
          400,
          'INSUFFICIENT_FUNDS',
          `Insufficient balance in ${account.name}. Available: ৳${account.currentBalance.toFixed(2)}`
        );
      }

      // 1. Deduct supplier payable balance
      const balanceBefore = supplier.currentPayableBalance;
      const balanceAfter = balanceBefore - amount;
      supplier.currentPayableBalance = balanceAfter;
      await supplier.save({ session });

      // 2. Debit payment account
      const accBalanceBefore = account.currentBalance;
      const accBalanceAfter = accBalanceBefore - amount;
      account.currentBalance = accBalanceAfter;
      await account.save({ session });

      // 3. Create SupplierLedger entry
      const ledger = await SupplierLedger.create(
        [
          {
            supplierId: supplier._id,
            transactionType: 'PAYMENT_DISBURSAL',
            amount,
            balanceBefore,
            balanceAfter,
            referenceType: 'DISBURSEMENT',
            referenceId: account._id,
            narration: `Payment disbursal from ${account.name}. ${dto.notes || ''}`.trim(),
            recordedById: new Types.ObjectId(recordedById),
          },
        ],
        { session }
      );

      // 4. Create AccountTransaction entry
      await AccountTransaction.create(
        [
          {
            accountId: account._id,
            type: 'DEBIT',
            amount,
            balanceBefore: accBalanceBefore,
            balanceAfter: accBalanceAfter,
            referenceType: 'SUPPLIER_PAYMENT',
            referenceId: supplier._id,
            description: `Payment to supplier ${supplier.companyName}`,
          },
        ],
        { session }
      );

      // 5. If paid from cash account, also track against active cashier shift if applicable
      if (account.accountType === 'CASH') {
        const activeShift = await Shift.findOne({
          userId: new Types.ObjectId(recordedById),
          status: 'OPEN',
        }).session(session);
        if (activeShift) {
          activeShift.cashExpensesTotal += amount;
          activeShift.expectedCash -= amount;
          await activeShift.save({ session });
        }
      }

      await session.commitTransaction();
      return ledger[0].toObject();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const supplierService = new SupplierService();
