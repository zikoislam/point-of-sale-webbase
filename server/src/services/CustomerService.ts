import { Types } from 'mongoose';
import { Customer, ICustomer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { Shift } from '../models/Shift';
import { AppError } from '../utils/app-error';

export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit?: number;
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  isActive?: boolean;
}

export interface DuePaymentDto {
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD';
  notes?: string;
}

class CustomerService {
  async list(page = 1, limit = 50, search?: string) {
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
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
      throw new AppError(409, 'DUPLICATE_PHONE', 'A customer with this phone number already exists');
    }

    const customer = await Customer.create({
      name: dto.name,
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
      if (dup) throw new AppError(409, 'DUPLICATE_PHONE', 'Phone number is already used by another customer');
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: dto },
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
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerLedger.countDocuments({ customerId }),
    ]);

    return { data: entries, total, page, totalPages: Math.ceil(total / limit) };
  }

  async collectDuePayment(customerId: string, dto: DuePaymentDto, recordedById: string) {
    if (!Types.ObjectId.isValid(customerId)) throw new AppError(400, 'INVALID_ID', 'Invalid customer ID');
    const customer = await Customer.findById(customerId);
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    const amount = Number(dto.amount);
    if (amount <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be greater than 0');
    if (amount > customer.currentDueBalance) {
      throw new AppError(400, 'OVERPAYMENT', `Amount exceeds current due balance of ৳${customer.currentDueBalance}`);
    }

    const balanceBefore = customer.currentDueBalance;
    const balanceAfter = balanceBefore - amount;
    customer.currentDueBalance = balanceAfter;
    await customer.save();

    const ledger = await CustomerLedger.create({
      customerId: customer._id,
      transactionType: 'PAYMENT_COLLECTION',
      amount,
      balanceBefore,
      balanceAfter,
      referenceType: 'RECEIPT',
      referenceId: new Types.ObjectId(recordedById),
      narration: `Due payment collection via ${dto.paymentMethod}. ${dto.notes || ''}`.trim(),
      recordedById: new Types.ObjectId(recordedById),
    });

    // If payment is CASH, accumulate into the cashier's active shift
    if (dto.paymentMethod === 'CASH') {
      const activeShift = await Shift.findOne({
        userId: new Types.ObjectId(recordedById),
        status: 'OPEN',
      });
      if (activeShift) {
        activeShift.cashSalesTotal += amount;
        activeShift.expectedCash += amount;
        await activeShift.save();
      }
    }

    return { customer, ledger };
  }
}

export const customerService = new CustomerService();
