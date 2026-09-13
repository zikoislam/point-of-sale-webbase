import { Types } from 'mongoose';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Supplier } from '../models/Supplier';
import { Account } from '../models/Account';
import { Expense } from '../models/Expense';
import { Shift } from '../models/Shift';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { StockMovement } from '../models/StockMovement';

class ReportService {
  async getDashboardMetrics() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      todaySales,
      monthSales,
      customers,
      suppliers,
      accounts,
      products,
      recentSales,
      openShifts,
    ] = await Promise.all([
      Sale.find({ createdAt: { $gte: todayStart } }).lean(),
      Sale.find({ createdAt: { $gte: monthStart } }).lean(),
      Customer.find().lean(),
      Supplier.find().lean(),
      Account.find().lean(),
      Product.find({ isActive: true }).lean(),
      Sale.find().sort({ createdAt: -1 }).limit(6).lean(),
      Shift.find({ status: 'OPEN' }).lean(),
    ]);

    // Calculations
    const todayTotalRevenue = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const todayOrdersCount = todaySales.length;

    const monthTotalRevenue = monthSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const monthOrdersCount = monthSales.length;

    const totalCustomerDues = customers.reduce((acc, c) => acc + (c.currentDueBalance || 0), 0);
    const totalSupplierPayables = suppliers.reduce((acc, s) => acc + (s.currentPayableBalance || 0), 0);
    const totalLiquidCapital = accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);

    let totalInventoryValuation = 0;
    let lowStockCount = 0;
    for (const p of products) {
      for (const v of p.variants) {
        totalInventoryValuation += (v.currentStock || 0) * (v.costPrice || 0);
        if ((v.currentStock || 0) <= (v.alertQty || 5)) lowStockCount++;
      }
    }

    // Top selling products aggregation
    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const s of monthSales) {
      for (const item of s.items) {
        const key = item.productName;
        if (!productSalesMap[key]) {
          productSalesMap[key] = { name: key, qty: 0, revenue: 0 };
        }
        productSalesMap[key].qty += item.quantity;
        productSalesMap[key].revenue += item.lineTotal;
      }
    }
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      today: {
        revenue: todayTotalRevenue,
        orders: todayOrdersCount,
      },
      month: {
        revenue: monthTotalRevenue,
        orders: monthOrdersCount,
      },
      kpis: {
        customerDues: totalCustomerDues,
        supplierPayables: totalSupplierPayables,
        liquidCapital: totalLiquidCapital,
        inventoryValuation: totalInventoryValuation,
        lowStockItems: lowStockCount,
        totalCustomers: customers.length,
        activeRegisterShifts: openShifts.length,
      },
      recentSales: recentSales.map((s) => ({
        id: s._id,
        invoiceNo: s.invoiceNo,
        totalAmount: s.totalAmount,
        paidAmount: s.paidAmount,
        dueAmount: s.dueAmount,
        itemsCount: s.items.length,
        createdAt: s.createdAt,
      })),
      topProducts,
    };
  }

  async getSalesReport(startDate?: string, endDate?: string) {
    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const sales = await Sale.find(query).sort({ createdAt: -1 }).lean();

    let totalGross = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const s of sales) {
      totalGross += s.subtotal || 0;
      totalTax += s.totalTax || 0;
      totalDiscount += s.discountAmount || 0;
      totalNet += s.totalAmount || 0;
      totalPaid += s.paidAmount || 0;
      totalDue += s.dueAmount || 0;
    }

    return {
      summary: {
        totalOrders: sales.length,
        totalGross,
        totalTax,
        totalDiscount,
        totalNet,
        totalPaid,
        totalDue,
      },
      data: sales,
    };
  }

  async getProductPerformance(startDate?: string, endDate?: string) {
    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query).lean();
    const map: Record<
      string,
      {
        productName: string;
        variantName: string;
        sku: string;
        unitsSold: number;
        revenue: number;
        cost: number;
        grossProfit: number;
      }
    > = {};

    for (const s of sales) {
      for (const item of s.items) {
        const key = `${item.variantId}`;
        if (!map[key]) {
          map[key] = {
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            unitsSold: 0,
            revenue: 0,
            cost: 0,
            grossProfit: 0,
          };
        }
        map[key].unitsSold += item.quantity;
        map[key].revenue += item.lineTotal;
        const lineCost = item.quantity * (item.unitCostPrice || 0);
        map[key].cost += lineCost;
        map[key].grossProfit += item.lineTotal - lineCost;
      }
    }

    const items = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    return items;
  }

  async getInventoryValuation() {
    const products = await Product.find({ isActive: true })
      .populate('categoryId', 'name')
      .populate('brandId', 'name')
      .lean();

    const items = [];
    let totalStockQty = 0;
    let totalValuation = 0;

    for (const p of products) {
      for (const v of p.variants) {
        const assetValue = (v.currentStock || 0) * (v.costPrice || 0);
        totalStockQty += v.currentStock || 0;
        totalValuation += assetValue;

        items.push({
          productName: p.name,
          categoryName: (p.categoryId as any)?.name || 'General',
          variantName: v.attributeName,
          sku: v.sku,
          unit: p.unit,
          costPrice: v.costPrice,
          retailPrice: v.retailSellingPrice,
          currentStock: v.currentStock,
          alertQty: v.alertQty,
          assetValue,
          status: (v.currentStock || 0) <= (v.alertQty || 5) ? 'LOW_STOCK' : 'HEALTHY',
        });
      }
    }

    return {
      summary: {
        totalVariants: items.length,
        totalStockQty,
        totalValuation,
      },
      data: items,
    };
  }

  async getProfitAndLoss(startDate?: string, endDate?: string) {
    const dateQuery: any = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.createdAt.$lte = end;
      }
    }

    const [sales, expenses] = await Promise.all([
      Sale.find(dateQuery).lean(),
      Expense.find(dateQuery).populate('categoryId', 'name code').lean(),
    ]);

    let totalRevenue = 0;
    let totalCOGS = 0;

    for (const s of sales) {
      totalRevenue += s.totalAmount;
      for (const item of s.items) {
        totalCOGS += item.quantity * (item.unitCostPrice || 0);
      }
    }

    const grossProfit = totalRevenue - totalCOGS;

    // Breakdown operating expenses vs wastage loss
    let totalOperatingExpenses = 0;
    let totalWastageLoss = 0;

    const expenseBreakdown: Record<string, number> = {};
    for (const e of expenses) {
      const catCode = (e.categoryId as any)?.code || 'GENERAL';
      const catName = (e.categoryId as any)?.name || 'General Expense';
      if (catCode === 'WASTAGE_LOSS') {
        totalWastageLoss += e.amount;
      } else {
        totalOperatingExpenses += e.amount;
      }
      expenseBreakdown[catName] = (expenseBreakdown[catName] || 0) + e.amount;
    }

    const netProfit = grossProfit - totalOperatingExpenses - totalWastageLoss;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: {
        startDate: startDate || 'All-Time',
        endDate: endDate || 'Present',
      },
      revenue: {
        totalSales: totalRevenue,
        cogs: totalCOGS,
        grossProfit,
        grossMarginPercentage: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      },
      expenses: {
        operatingExpenses: totalOperatingExpenses,
        wastageLoss: totalWastageLoss,
        totalExpenses: totalOperatingExpenses + totalWastageLoss,
        breakdown: expenseBreakdown,
      },
      netProfit,
      netProfitMargin: parseFloat(profitMargin.toFixed(2)),
    };
  }

  async getCustomerDueAging() {
    const customers = await Customer.find({ currentDueBalance: { $gt: 0 } })
      .sort({ currentDueBalance: -1 })
      .lean();

    const totalDue = customers.reduce((acc, c) => acc + c.currentDueBalance, 0);

    return {
      summary: {
        customersWithDue: customers.length,
        totalOutstandingDue: totalDue,
      },
      data: customers.map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        creditLimit: c.creditLimit,
        currentDueBalance: c.currentDueBalance,
        riskLevel: c.creditLimit > 0 && c.currentDueBalance >= c.creditLimit ? 'HIGH_RISK' : 'NORMAL',
      })),
    };
  }

  async getSupplierPayables() {
    const suppliers = await Supplier.find({ currentPayableBalance: { $gt: 0 } })
      .sort({ currentPayableBalance: -1 })
      .lean();

    const totalPayable = suppliers.reduce((acc, s) => acc + s.currentPayableBalance, 0);

    return {
      summary: {
        suppliersWithPayable: suppliers.length,
        totalOutstandingPayable: totalPayable,
      },
      data: suppliers.map((s) => ({
        id: s._id,
        companyName: s.companyName,
        contactPerson: s.contactPerson,
        phone: s.phone,
        currentPayableBalance: s.currentPayableBalance,
      })),
    };
  }

  async getPurchaseReport(startDate?: string, endDate?: string) {
    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pos = await PurchaseOrder.find(query)
      .populate('supplierId', 'companyName phone')
      .sort({ createdAt: -1 })
      .lean();

    let totalOrderedValue = 0;
    let totalPaid = 0;
    let totalDue = 0;
    for (const po of pos) {
      totalOrderedValue += po.totalAmount || 0;
      totalPaid += po.paidAmount || 0;
      totalDue += po.dueAmount || 0;
    }

    return {
      summary: {
        totalPurchaseOrders: pos.length,
        totalOrderedValue,
        totalPaid,
        totalDue,
      },
      data: pos,
    };
  }

  async getInventoryWastageReport(startDate?: string, endDate?: string) {
    const query: any = { type: 'WASTAGE' };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const movements = await StockMovement.find(query)
      .populate('productId', 'name unit')
      .populate('userId', 'fullName name')
      .sort({ createdAt: -1 })
      .lean();

    let totalQty = 0;
    let totalLossValue = 0;
    const data = movements.map((m) => {
      const lossValue = (m.quantity || 0) * (m.unitCost || 0);
      totalQty += m.quantity || 0;
      totalLossValue += lossValue;
      return {
        id: m._id,
        productName: (m.productId as any)?.name || 'Unknown',
        unit: (m.productId as any)?.unit || '',
        quantity: m.quantity,
        unitCost: m.unitCost,
        lossValue,
        reason: m.reason,
        recordedBy: (m.userId as any)?.fullName || (m.userId as any)?.name || '',
        createdAt: m.createdAt,
      };
    });

    return {
      summary: {
        totalWastageEvents: movements.length,
        totalQty,
        totalLossValue,
      },
      data,
    };
  }
}

export const reportService = new ReportService();
