import mongoose, { Types } from 'mongoose';
import { Shift, IShift } from '../models/Shift';
import { Sale } from '../models/Sale';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';

export interface OpenShiftDto {
  openingFloat: number;
  terminalId?: string;
  notes?: string;
}

export interface PettyCashDto {
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
}

export interface CloseShiftDto {
  actualCash: number;
  notes?: string;
  managerApprovalId?: string;
  managerPin?: string;
}

const MANAGER_ROLES = ['BRANCH_MANAGER', 'SUPER_ADMIN'];

async function verifyManagerPin(pin: string): Promise<Types.ObjectId> {
  const roles = await Role.find({ name: { $in: MANAGER_ROLES } });
  const managers = await User.find({ roleId: { $in: roles.map((r) => r._id) }, isActive: true });
  for (const manager of managers) {
    if (await manager.comparePin(pin)) return manager._id;
  }
  throw new AppError(403, 'DISCREPANCY_REQUIRES_APPROVAL', 'Invalid manager PIN for shift discrepancy approval');
}

async function isManager(userId: string): Promise<boolean> {
  const user = await User.findById(userId).populate<{ roleId: any }>('roleId');
  return !!user && MANAGER_ROLES.includes(user.roleId?.name);
}

class ShiftService {
  async getActiveShift(userId: string): Promise<IShift | null> {
    const shift = await Shift.findOne({
      userId: new Types.ObjectId(userId),
      status: 'OPEN',
    })
      .populate('userId', 'name email')
      .lean();
    return shift as unknown as IShift | null;
  }

  async openShift(userId: string, dto: OpenShiftDto): Promise<IShift> {
    const existing = await Shift.findOne({
      userId: new Types.ObjectId(userId),
      status: 'OPEN',
    });
    if (existing) {
      throw new AppError(409, 'SHIFT_ALREADY_OPEN', 'User already has an open shift on terminal ' + existing.terminalId);
    }

    const openingFloat = Number(dto.openingFloat) || 0;
    const shift = await Shift.create({
      userId: new Types.ObjectId(userId),
      terminalId: dto.terminalId || 'COUNTER-01',
      openingFloat,
      cashSalesTotal: 0,
      cashExpensesTotal: 0,
      pettyCashIn: 0,
      pettyCashOut: 0,
      expectedCash: openingFloat,
      status: 'OPEN',
      notes: dto.notes,
      openedAt: new Date(),
    });

    return shift.toObject() as unknown as IShift;
  }

  async addPettyCash(shiftId: string, dto: PettyCashDto, userId: string): Promise<IShift> {
    if (!Types.ObjectId.isValid(shiftId)) throw new AppError(400, 'INVALID_ID', 'Invalid shift ID');
    const shift = await Shift.findById(shiftId);
    if (!shift) throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found');
    if (shift.userId.toString() !== userId && !(await isManager(userId))) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You can only adjust your own shift');
    }
    if (shift.status !== 'OPEN') throw new AppError(422, 'SHIFT_CLOSED_CANNOT_CHECKOUT', 'Cannot adjust petty cash for a closed shift');

    const amount = Number(dto.amount);
    if (amount <= 0) throw new AppError(400, 'INVALID_AMOUNT', 'Petty cash amount must be greater than 0');

    if (dto.type === 'IN') {
      shift.pettyCashIn = roundMoney(shift.pettyCashIn + amount);
    } else {
      shift.pettyCashOut = roundMoney(shift.pettyCashOut + amount);
    }

    shift.expectedCash = roundMoney(
      shift.openingFloat +
        shift.cashSalesTotal +
        shift.pettyCashIn -
        shift.cashExpensesTotal -
        shift.pettyCashOut
    );

    await shift.save();
    return shift.toObject() as unknown as IShift;
  }

  async closeShift(shiftId: string, dto: CloseShiftDto, userId: string): Promise<IShift> {
    if (!Types.ObjectId.isValid(shiftId)) throw new AppError(400, 'INVALID_ID', 'Invalid shift ID');
    const shift = await Shift.findById(shiftId);
    if (!shift) throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found');
    if (shift.status !== 'OPEN') throw new AppError(400, 'SHIFT_ALREADY_CLOSED', 'Shift is already closed');
    if (shift.userId.toString() !== userId && !(await isManager(userId))) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You can only close your own shift');
    }

    // cashSalesTotal is maintained incrementally by checkout / due collection / refunds.
    const expectedCash = roundMoney(
      shift.openingFloat +
        shift.cashSalesTotal +
        shift.pettyCashIn -
        shift.cashExpensesTotal -
        shift.pettyCashOut
    );

    const actualCash = Number(dto.actualCash) || 0;
    const discrepancy = roundMoney(actualCash - expectedCash);

    // Rule 7: discrepancies beyond ৳10 require a verified Manager PIN
    if (Math.abs(discrepancy) > 10) {
      if (!dto.managerPin) {
        throw new AppError(
          403,
          'DISCREPANCY_REQUIRES_APPROVAL',
          `Cash discrepancy of ৳${discrepancy} exceeds ৳10. Manager PIN is required to close this shift.`
        );
      }
      shift.managerApprovalId = await verifyManagerPin(dto.managerPin);
    }

    shift.expectedCash = expectedCash;
    shift.actualCash = actualCash;
    shift.discrepancy = discrepancy;
    shift.status = 'CLOSED';
    shift.closedAt = new Date();
    if (dto.notes) shift.notes = (shift.notes ? shift.notes + ' | ' : '') + dto.notes;

    await shift.save();

    // Broadcast discrepancy alert & log to audit if |discrepancy| > 10
    if (Math.abs(discrepancy) > 10) {
      try {
        const { emitToRoles } = await import('../sockets');
        emitToRoles('SHIFT_DISCREPANCY_ALERT', {
          shiftId: shift._id.toString(),
          terminalId: shift.terminalId,
          cashierId: shift.userId.toString(),
          expectedCash,
          actualCash,
          discrepancy,
          notes: shift.notes,
        });

        const { auditService } = await import('./AuditService');
        await auditService.logAction(
          shift.userId.toString(),
          'SHIFT_DISCREPANCY',
          'shifts',
          shift._id.toString(),
          { expectedCash, actualCash, discrepancy, notes: shift.notes }
        );
      } catch (err) {
        console.error('Failed to log/emit shift discrepancy alert:', err);
      }
    }

    return shift.toObject() as unknown as IShift;
  }


  async getZReport(shiftId: string) {
    if (!Types.ObjectId.isValid(shiftId)) throw new AppError(400, 'INVALID_ID', 'Invalid shift ID');
    const shift = await Shift.findById(shiftId)
      .populate('userId', 'name email')
      .populate('managerApprovalId', 'name')
      .lean();
    if (!shift) throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found');

    const sales = await Sale.find({ shiftId: shift._id }).lean();

    let totalGrossSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let paymentBreakdown: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      MFS_BKASH: 0,
      MFS_NAGAD: 0,
      STORE_CREDIT: 0,
      CUSTOMER_DUE: 0,
    };

    for (const s of sales) {
      totalGrossSales += s.totalAmount;
      totalTax += s.totalTax || 0;
      totalDiscount += s.discountAmount || 0;
      for (const p of s.payments) {
        paymentBreakdown[p.method] = (paymentBreakdown[p.method] || 0) + p.amount;
      }
    }

    return {
      shift,
      summary: {
        totalSalesCount: sales.length,
        totalGrossSales,
        totalTax,
        totalDiscount,
        paymentBreakdown,
        openingFloat: shift.openingFloat,
        cashCollected: shift.cashSalesTotal,
        pettyCashIn: shift.pettyCashIn,
        pettyCashOut: shift.pettyCashOut,
        cashExpenses: shift.cashExpensesTotal,
        expectedCash: shift.expectedCash,
        actualCash: shift.actualCash ?? null,
        discrepancy: shift.discrepancy ?? null,
      },
    };
  }

  async listShifts(page = 1, limit = 20, status?: string, userId?: string) {
    const query: any = {};
    if (status) query.status = status;
    if (userId && Types.ObjectId.isValid(userId)) query.userId = new Types.ObjectId(userId);

    const [shifts, total] = await Promise.all([
      Shift.find(query)
        .populate('userId', 'name email')
        .populate('managerApprovalId', 'name')
        .sort({ openedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Shift.countDocuments(query),
    ]);

    return { data: shifts, total, page, totalPages: Math.ceil(total / limit) };
  }
}

export const shiftService = new ShiftService();
