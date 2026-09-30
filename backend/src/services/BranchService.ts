import mongoose, { Types } from 'mongoose';
import { Branch, IBranch } from '../models/Branch';
import { Sale } from '../models/Sale';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Product } from '../models/Product';
import { Expense } from '../models/Expense';
import { User } from '../models/User';
import { StockTransfer } from '../models/StockTransfer';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';

export interface BranchDto {
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  managerId?: string | null;
  isHeadOffice?: boolean;
  isActive?: boolean;
  settings?: { allowNegativeStock?: boolean; defaultPriceType?: 'RETAIL' | 'WHOLESALE' };
}

/** Local midnight of today — every branch report is measured from here. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

class BranchService {
  async list(options: { includeInactive?: boolean } = {}) {
    const filter: Record<string, any> = {};
    if (!options.includeInactive) filter.isActive = true;

    const branches = await Branch.find(filter)
      .populate('managerId', 'fullName username')
      .sort({ isHeadOffice: -1, name: 1 })
      .lean();

    // Today's takings per branch, in one pass (sales carry no status — a
    // document exists for every completed checkout)
    const from = startOfToday();
    const today = await Sale.aggregate([
      { $match: { branchId: { $ne: null }, createdAt: { $gte: from } } },
      { $group: { _id: '$branchId', sales: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const byBranch = new Map(today.map((t: any) => [String(t._id), t]));

    // Headcount per branch
    const staff = await User.aggregate([
      { $match: { branchId: { $ne: null }, isActive: true } },
      { $group: { _id: '$branchId', count: { $sum: 1 } } },
    ]);
    const staffByBranch = new Map(staff.map((s: any) => [String(s._id), s.count]));

    return branches.map((b: any) => {
      const t: any = byBranch.get(String(b._id));
      return {
        ...b,
        todaySales: roundMoney(t?.sales || 0),
        todayInvoiceCount: t?.count || 0,
        staffCount: staffByBranch.get(String(b._id)) || 0,
      };
    });
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid branch ID');
    const branch = await Branch.findById(id).populate('managerId', 'fullName username phone').lean();
    if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found');
    return branch;
  }

  async create(dto: BranchDto) {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await Branch.findOne({ code }).lean();
    if (duplicate) throw new AppError(409, 'BRANCH_CODE_EXISTS', `Branch code ${code} is already used`);

    if (dto.isHeadOffice) {
      // Only one head office per organization — demote the previous one
      await Branch.updateMany({ isHeadOffice: true }, { $set: { isHeadOffice: false } });
    }

    const branch = await Branch.create({
      name: dto.name.trim(),
      code,
      address: dto.address,
      city: dto.city,
      phone: dto.phone,
      managerId: dto.managerId || null,
      isHeadOffice: !!dto.isHeadOffice,
      isActive: dto.isActive !== false,
      settings: {
        allowNegativeStock: !!dto.settings?.allowNegativeStock,
        defaultPriceType: dto.settings?.defaultPriceType || 'RETAIL',
      },
    });
    return branch.toObject() as unknown as IBranch;
  }

  async update(id: string, dto: Partial<BranchDto>) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid branch ID');
    const branch = await Branch.findById(id);
    if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found');

    if (dto.code && dto.code.trim().toUpperCase() !== branch.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await Branch.findOne({ code, _id: { $ne: branch._id } }).lean();
      if (duplicate) throw new AppError(409, 'BRANCH_CODE_EXISTS', `Branch code ${code} is already used`);
      branch.code = code;
    }
    if (dto.isHeadOffice) {
      await Branch.updateMany({ isHeadOffice: true, _id: { $ne: branch._id } }, { $set: { isHeadOffice: false } });
    }
    if (dto.name !== undefined) branch.name = dto.name.trim();
    if (dto.address !== undefined) branch.address = dto.address;
    if (dto.city !== undefined) branch.city = dto.city;
    if (dto.phone !== undefined) branch.phone = dto.phone;
    if (dto.managerId !== undefined) branch.managerId = dto.managerId ? new Types.ObjectId(dto.managerId) : null;
    if (dto.isHeadOffice !== undefined) branch.isHeadOffice = !!dto.isHeadOffice;
    if (dto.isActive !== undefined) branch.isActive = !!dto.isActive;
    if (dto.settings) {
      if (dto.settings.allowNegativeStock !== undefined) branch.settings.allowNegativeStock = !!dto.settings.allowNegativeStock;
      if (dto.settings.defaultPriceType) branch.settings.defaultPriceType = dto.settings.defaultPriceType;
    }

    await branch.save();
    return branch.toObject() as unknown as IBranch;
  }

  /**
   * A branch can only be removed once nothing points at it — otherwise history
   * would lose its context. Suggested action: deactivate instead.
   */
  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid branch ID');
    const oid = new Types.ObjectId(id);
    const branch = await Branch.findById(oid).lean();
    if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found');

    const [sales, pos, transfers, staff] = await Promise.all([
      Sale.countDocuments({ branchId: oid }),
      PurchaseOrder.countDocuments({ branchId: oid }),
      StockTransfer.countDocuments({ $or: [{ fromBranchId: oid }, { toBranchId: oid }] }),
      User.countDocuments({ branchId: oid }),
    ]);
    if (sales + pos + transfers + staff > 0) {
      throw new AppError(
        409,
        'BRANCH_IN_USE',
        `This branch has ${sales} sale(s), ${pos} purchase order(s), ${transfers} transfer(s) and ${staff} staff. Deactivate it instead.`
      );
    }

    await Branch.deleteOne({ _id: oid });
    return { ok: true };
  }

  /** Single-branch scorecard used by the branch detail drawer. */
  async getStats(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid branch ID');
    const oid = new Types.ObjectId(id);
    const from = startOfToday();

    const [todayAgg, stockAgg, pendingPo, lowStock, transfersOut, transfersIn] = await Promise.all([
      Sale.aggregate([
        { $match: { branchId: oid, createdAt: { $gte: from } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmount' },
            invoices: { $sum: 1 },
            due: { $sum: '$dueAmount' },
            discount: { $sum: '$discountAmount' },
          },
        },
      ]),
      Product.aggregate([
        { $unwind: '$variants' },
        { $unwind: '$variants.branchStock' },
        { $match: { 'variants.branchStock.branchId': oid } },
        {
          $group: {
            _id: null,
            stockValue: {
              $sum: { $multiply: ['$variants.branchStock.quantity', '$variants.costPrice'] },
            },
            items: { $sum: 1 },
          },
        },
      ]),
      PurchaseOrder.countDocuments({ branchId: oid, status: { $in: ['DRAFT', 'ORDERED', 'PARTIAL'] } }),
      Product.aggregate([
        { $unwind: '$variants' },
        { $unwind: '$variants.branchStock' },
        { $match: { 'variants.branchStock.branchId': oid } },
        {
          $match: {
            $expr: { $lte: ['$variants.branchStock.quantity', '$variants.alertQty'] },
          },
        },
        { $count: 'count' },
      ]),
      StockTransfer.countDocuments({ fromBranchId: oid, status: { $in: ['PENDING', 'IN_TRANSIT'] } }),
      StockTransfer.countDocuments({ toBranchId: oid, status: { $in: ['PENDING', 'IN_TRANSIT'] } }),
    ]);

    const t: any = todayAgg[0] || {};
    const s: any = stockAgg[0] || {};
    return {
      branchId: id,
      todayRevenue: roundMoney(t.revenue || 0),
      todayInvoices: t.invoices || 0,
      todayDue: roundMoney(t.due || 0),
      todayDiscount: roundMoney(t.discount || 0),
      stockValue: roundMoney(s.stockValue || 0),
      variantCount: s.items || 0,
      pendingPurchaseOrders: pendingPo,
      lowStockItems: lowStock[0]?.count || 0,
      transfersOut,
      transfersIn,
    };
  }

  /**
   * 7.2 Chain dashboard: consolidated numbers across every branch plus a
   * month-by-month revenue series and a simple P&L per branch.
   */
  async getChainDashboard(options: { months?: number } = {}) {
    const months = Math.min(Math.max(options.months || 6, 1), 24);
    const branches = await Branch.find({ isActive: true }).sort({ isHeadOffice: -1, name: 1 }).lean();
    if (branches.length === 0) {
      return { branches: [], totals: null, monthlySeries: [], pnl: [], rangeStart: null, rangeEnd: null };
    }

    const rangeStart = new Date();
    rangeStart.setDate(1);
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setMonth(rangeStart.getMonth() - (months - 1));

    const branchIds = branches.map((b: any) => b._id);

    const [revByBranch, monthly, expenseByBranch, stockByBranch, purchaseByBranch] = await Promise.all([
      // Revenue per branch for the whole window
      Sale.aggregate([
        { $match: { branchId: { $in: branchIds }, createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: '$branchId',
            revenue: { $sum: '$totalAmount' },
            invoices: { $sum: 1 },
            due: { $sum: '$dueAmount' },
            tax: { $sum: '$taxAmount' },
            discount: { $sum: '$discountAmount' },
          },
        },
      ]),
      // Month × branch matrix for the chart
      Sale.aggregate([
        { $match: { branchId: { $in: branchIds }, createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: {
              branchId: '$branchId',
              month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { '_id.month': 1 } },
      ]),
      Expense.aggregate([
        { $match: { branchId: { $in: branchIds }, date: { $gte: rangeStart } } },
        { $group: { _id: '$branchId', expenses: { $sum: '$amount' } } },
      ]),
      Product.aggregate([
        { $unwind: '$variants' },
        { $unwind: '$variants.branchStock' },
        { $match: { 'variants.branchStock.branchId': { $in: branchIds } } },
        {
          $group: {
            _id: '$variants.branchStock.branchId',
            stockValue: {
              $sum: { $multiply: ['$variants.branchStock.quantity', '$variants.costPrice'] },
            },
            items: { $sum: 1 },
          },
        },
      ]),
      PurchaseOrder.aggregate([
        { $match: { branchId: { $in: branchIds }, status: { $ne: 'CANCELLED' }, createdAt: { $gte: rangeStart } } },
        { $group: { _id: '$branchId', purchases: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      ]),
    ]);

    const revMap = new Map(revByBranch.map((r: any) => [String(r._id), r]));
    const expMap = new Map(expenseByBranch.map((e: any) => [String(e._id), e.expenses]));
    const stockMap = new Map(stockByBranch.map((s: any) => [String(s._id), s]));
    const purMap = new Map(purchaseByBranch.map((p: any) => [String(p._id), p]));

    const pnl = branches.map((b: any) => {
      const r: any = revMap.get(String(b._id)) || {};
      const revenue = roundMoney(r.revenue || 0);
      const purchases: any = purMap.get(String(b._id)) || {};
      const expenses = roundMoney(expMap.get(String(b._id)) || 0);
      const cogs = roundMoney(purchases.purchases || 0);
      const grossProfit = roundMoney(revenue - cogs);
      return {
        branchId: String(b._id),
        branchName: b.name,
        code: b.code,
        revenue,
        invoices: r.invoices || 0,
        due: roundMoney(r.due || 0),
        cogs,
        grossProfit,
        grossMargin: revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0,
        expenses,
        netProfit: roundMoney(grossProfit - expenses),
      };
    });

    const totals = pnl.reduce(
      (acc: any, row: any) => ({
        revenue: roundMoney(acc.revenue + row.revenue),
        cogs: roundMoney(acc.cogs + row.cogs),
        grossProfit: roundMoney(acc.grossProfit + row.grossProfit),
        expenses: roundMoney(acc.expenses + row.expenses),
        netProfit: roundMoney(acc.netProfit + row.netProfit),
        due: roundMoney(acc.due + row.due),
        invoices: acc.invoices + row.invoices,
      }),
      { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, due: 0, invoices: 0 }
    );

    // Shape the month × branch matrix into a chart-friendly series
    const monthKeys: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(rangeStart);
      d.setMonth(rangeStart.getMonth() + i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const monthlySeries = monthKeys.map((key) => {
      const row: Record<string, any> = { month: key };
      for (const b of branches) {
        const hit: any = monthly.find((m: any) => m._id.month === key && String(m._id.branchId) === String(b._id));
        row[b.code] = roundMoney(hit?.revenue || 0);
      }
      return row;
    });

    // Open purchase orders per branch (one query instead of N)
    const openPo = await PurchaseOrder.aggregate([
      { $match: { branchId: { $in: branchIds }, status: { $in: ['DRAFT', 'ORDERED', 'PARTIAL'] } } },
      { $group: { _id: '$branchId', count: { $sum: 1 } } },
    ]);
    const openPoMap = new Map(openPo.map((p: any) => [String(p._id), p.count]));

    return {
      branches: branches.map((b: any) => ({
        id: String(b._id),
        name: b.name,
        code: b.code,
        city: b.city,
        isHeadOffice: b.isHeadOffice,
        revenue: roundMoney((revMap.get(String(b._id)) as any)?.revenue || 0),
        invoices: (revMap.get(String(b._id)) as any)?.invoices || 0,
        stockValue: roundMoney((stockMap.get(String(b._id)) as any)?.stockValue || 0),
        stockItems: (stockMap.get(String(b._id)) as any)?.items || 0,
        purchases: roundMoney((purMap.get(String(b._id)) as any)?.purchases || 0),
        pendingPurchaseOrders: openPoMap.get(String(b._id)) || 0,
      })),
      totals,
      monthlySeries,
      pnl,
      rangeStart,
      rangeEnd: new Date(),
    };
  }

  /** Assign (or clear) the home branch of a user. */
  async assignUser(userId: string, branchId: string | null) {
    if (!Types.ObjectId.isValid(userId)) throw new AppError(400, 'INVALID_ID', 'Invalid user ID');
    if (branchId && !Types.ObjectId.isValid(branchId)) throw new AppError(400, 'INVALID_ID', 'Invalid branch ID');
    if (branchId) {
      const branch = await Branch.findById(branchId).lean();
      if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found');
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { branchId: branchId ? new Types.ObjectId(branchId) : null } },
      { new: true }
    ).select('fullName username branchId');
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return user.toObject();
  }

  /**
   * Stock held per branch for one product — powers the transfer builder and
   * answers "where is this item?".
   */
  async getProductAvailability(productId: string) {
    if (!Types.ObjectId.isValid(productId)) throw new AppError(400, 'INVALID_ID', 'Invalid product ID');
    const product: any = await Product.findById(productId).select('name variants').lean();
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

    const branches = await Branch.find({ isActive: true }).select('name code isHeadOffice').lean();
    const branchById = new Map(branches.map((b: any) => [String(b._id), b]));

    const rows: any[] = [];
    for (const v of product.variants || []) {
      const entries = v.branchStock || [];
      if (entries.length === 0) {
        // Never split across branches — the whole stock is organisation-wide
        rows.push({
          variantId: String(v._id),
          variantName: v.attributeName,
          sku: v.sku,
          barcode: v.barcode,
          branchId: null,
          branchName: null,
          branchCode: null,
          quantity: v.currentStock,
          costPrice: v.costPrice,
          sellingPrice: v.retailSellingPrice,
          alertQty: v.alertQty,
          unassigned: true,
        });
        continue;
      }
      for (const e of entries) {
        const b: any = branchById.get(String(e.branchId));
        rows.push({
          variantId: String(v._id),
          variantName: v.attributeName,
          sku: v.sku,
          barcode: v.barcode,
          branchId: String(e.branchId),
          branchName: b?.name || 'Unknown',
          branchCode: b?.code || '-',
          quantity: e.quantity,
          costPrice: v.costPrice,
          sellingPrice: v.retailSellingPrice,
          alertQty: v.alertQty,
          unassigned: false,
        });
      }
    }

    return {
      productId,
      productName: product.name,
      branches: branches.map((b: any) => ({ id: String(b._id), name: b.name, code: b.code })),
      rows,
      unassignedVariants: rows.filter((r) => r.unassigned).length,
    };
  }
}

export const branchService = new BranchService();
