import mongoose, { Types } from 'mongoose';
import { Customer, ICustomer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { Shift } from '../models/Shift';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { AppError } from '../utils/app-error';
import { escapeRegex, roundMoney } from '../utils/helpers';

export interface CreateCustomerDto {
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit?: number;
}

export interface UpdateCustomerDto {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  loyaltyPoints?: number;
  isActive?: boolean;
}

export interface DuePaymentDto {
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD' | 'STORE_CREDIT';
  paymentAccountId?: string;
  narration?: string;
  notes?: string;
  /** YYYY-MM-DD the payment was received; defaults to now. */
  date?: string;
}

class CustomerService {
  async list(page = 1, limit = 50, search?: string) {
    const query: any = {};
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return {
      data: customers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string): Promise<ICustomer> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');
    const customer = await Customer.findById(id).lean();
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    return customer as unknown as ICustomer;
  }

  async create(dto: CreateCustomerDto): Promise<ICustomer> {
    const existing = await Customer.findOne({ phone: dto.phone }).lean();
    if (existing) {
      throw new AppError(409, 'CUSTOMER_PHONE_DUPLICATE', 'A customer with this phone number already exists');
    }

    const customer = await Customer.create({
      name: dto.name,
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      creditLimit: Number(dto.creditLimit) || 0,
      currentDueBalance: 0,
      loyaltyPoints: 0,
    });

    return customer.toObject() as unknown as ICustomer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<ICustomer> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');

    if (dto.phone) {
      const dup = await Customer.findOne({ phone: dto.phone, _id: { $ne: id } }).lean();
      if (dup) throw new AppError(409, 'CUSTOMER_PHONE_DUPLICATE', 'Phone number is already used by another customer');
    }

    const updates: Record<string, any> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.contactPerson !== undefined) updates.contactPerson = dto.contactPerson;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.address !== undefined) updates.address = dto.address;
    if (dto.creditLimit !== undefined) updates.creditLimit = dto.creditLimit;
    if (dto.loyaltyPoints !== undefined) updates.loyaltyPoints = dto.loyaltyPoints;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;

    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    return customer as unknown as ICustomer;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');
    const customer = await Customer.findById(id).lean();
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    if (customer.currentDueBalance > 0) {
      throw new AppError(400, 'HAS_DUE_BALANCE', 'Cannot delete customer with outstanding due balance');
    }
    await Customer.findByIdAndDelete(id);
  }

  async getLedger(customerId: string, page = 1, limit = 30) {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');
    const [entries, total] = await Promise.all([
      CustomerLedger.find({ customerId })
        .populate('recordedById', 'name')
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerLedger.countDocuments({ customerId }),
    ]);

    return { data: entries, total, page, totalPages: Math.ceil(total / limit) };
  }

  async collectDuePayment(customerId: string, dto: DuePaymentDto, recordedById: string) {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');

    const amount = roundMoney(Number(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be greater than 0');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
      if (amount > customer.currentDueBalance) {
        throw new AppError(400, 'OVERPAYMENT', `Amount exceeds current due balance of ৳${customer.currentDueBalance}`);
      }

      const balanceBefore = customer.currentDueBalance;
      const balanceAfter = roundMoney(balanceBefore - amount);
      customer.currentDueBalance = balanceAfter;
      await customer.save({ session });

      const ledger = await CustomerLedger.create(
        [
          {
            customerId: customer._id,
            transactionType: 'PAYMENT_COLLECTION',
            amount,
            balanceBefore,
            balanceAfter,
            referenceType: 'RECEIPT',
            referenceId: new Types.ObjectId(recordedById),
            narration: `Due payment collection via ${dto.paymentMethod}. ${dto.narration || dto.notes || ''}`.trim(),
            // The collector can date the receipt to the day the money arrived
            transactionDate: dto.date ? new Date(`${dto.date}T12:00:00.000Z`) : new Date(),
            recordedById: new Types.ObjectId(recordedById),
          },
        ],
        { session }
      );

      // Credit the receiving financial account (Rule: due collection credits account)
      if (dto.paymentAccountId && Types.ObjectId.isValid(dto.paymentAccountId)) {
        const account = await Account.findById(dto.paymentAccountId).session(session);
        if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Payment account not found');
        if (!account.isActive) throw new AppError(422, 'ACCOUNT_NOT_ACTIVE', `Account ${account.name} is inactive`);

        const acctBefore = account.currentBalance;
        const acctAfter = roundMoney(acctBefore + amount);
        account.currentBalance = acctAfter;
        await account.save({ session });

        await AccountTransaction.create(
          [
            {
              accountId: account._id,
              type: 'CREDIT',
              amount,
              balanceBefore: acctBefore,
              balanceAfter: acctAfter,
              referenceType: 'DUE_COLLECTION',
              referenceId: customer._id,
              description: `Customer due collection from ${customer.name}`,
            },
          ],
          { session }
        );
      }

      // If payment is CASH, accumulate into the cashier's active shift
      if (dto.paymentMethod === 'CASH') {
        const activeShift = await Shift.findOne({
          userId: new Types.ObjectId(recordedById),
          status: 'OPEN',
        }).session(session);
        if (activeShift) {
          activeShift.cashSalesTotal = roundMoney(activeShift.cashSalesTotal + amount);
          activeShift.expectedCash = roundMoney(activeShift.expectedCash + amount);
          await activeShift.save({ session });
        }
      }

      await session.commitTransaction();
      return { customer, ledger: ledger[0] };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async editLedgerEntry(customerId: string, ledgerId: string, data: { amount?: number; narration?: string; transactionDate?: string }) {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');
    if (!Types.ObjectId.isValid(ledgerId)) throw new AppError(400, 'INVALID_ID', 'Invalid ledger ID');

    const customer = await Customer.findById(customerId);
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    const targetLedger = await CustomerLedger.findOne({ _id: ledgerId, customerId });
    if (!targetLedger) throw new AppError(404, 'LEDGER_NOT_FOUND', 'Ledger entry not found');

    // Build update fields for the target entry and write directly via updateOne
    // (bypasses Mongoose validators so older entries with empty narration don't crash)
    const entryUpdate: Record<string, any> = {};
    if (data.amount !== undefined && data.amount >= 0) {
      entryUpdate.amount = roundMoney(data.amount);
    }
    if (data.narration !== undefined) {
      entryUpdate.narration = data.narration.trim();
    }
    if (data.transactionDate) {
      entryUpdate.transactionDate = new Date(data.transactionDate);
    }

    // Use a session so the ledger bulkWrite + customer balance update are atomic.
    // Without this, a crash between the two writes leaves the ledger corrected
    // but the customer's currentDueBalance stale — which is the bug seen in prod.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (Object.keys(entryUpdate).length > 0) {
        await CustomerLedger.updateOne(
          { _id: ledgerId, customerId },
          { $set: entryUpdate },
          { session }
        );
      }

      // Recalculate all balances from the beginning.
      // Must run inside the session so we read our own un-committed write above.
      const allLedgers = await CustomerLedger.find({ customerId })
        .sort({ transactionDate: 1, createdAt: 1 })
        .session(session)
        .lean();

      let runningBalance = 0;
      const bulkOps: any[] = [];

      for (const ledger of allLedgers) {
        const balanceBefore = runningBalance;

        if (ledger.transactionType === 'OPENING' || ledger.transactionType === 'SALE_DUE') {
          runningBalance = roundMoney(runningBalance + ledger.amount);
        } else if (
          ledger.transactionType === 'PAYMENT_COLLECTION' ||
          ledger.transactionType === 'RETURN_CREDIT'
        ) {
          runningBalance = roundMoney(runningBalance - ledger.amount);
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: ledger._id },
            update: { $set: { balanceBefore, balanceAfter: runningBalance } },
          },
        });
      }

      if (bulkOps.length > 0) {
        await CustomerLedger.bulkWrite(bulkOps, { session });
      }

      // Update customer due balance directly (avoid customer.save() validators)
      await Customer.updateOne(
        { _id: customerId },
        { $set: { currentDueBalance: runningBalance } },
        { session }
      );

      await session.commitTransaction();
      return { success: true, newBalance: runningBalance };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const customerService = new CustomerService();
