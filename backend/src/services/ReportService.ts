import { Types } from 'mongoose';
import { Sale } from '../models/Sale';
import { SalesReturn } from '../models/SalesReturn';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Supplier } from '../models/Supplier';
import { Account } from '../models/Account';
import { Expense } from '../models/Expense';
import { Shift } from '../models/Shift';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';
import { importExportService } from './ImportExportService';
import { OnlineOrder } from '../models/OnlineOrder';

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

  async getSalesReport(startDate?: string, endDate?: string, orgId?: string) {
    const query: any = {};
    if (orgId && Types.ObjectId.isValid(orgId)) query.orgId = new Types.ObjectId(orgId);
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
      // Per-staff performance — managers see who sold what within their privilege scope
      cashierBreakdown: await this.cashierBreakdown(query),
      // Wholesale & Retail split — how much sold on each pricing tier
      tierBreakdown: await Sale.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$pricingTier',
            orders: { $sum: 1 },
            total: { $sum: '$totalAmount' },
          },
        },
        { $sort: { total: -1 } },
      ]),
      data: sales,
    };
  }

  /** Groups sales by cashier for the staff performance table. */
  private async cashierBreakdown(query: any): Promise<Array<{ cashierId: string; name: string; orders: number; totalNet: number; totalDue: number }>> {
    const rows = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$cashierId',
          orders: { $sum: 1 },
          totalNet: { $sum: '$totalAmount' },
          totalDue: { $sum: '$dueAmount' },
        },
      },
      { $sort: { totalNet: -1 } },
    ]);

    const { User } = await import('../models/User');
    const ids = rows.map((r: any) => r._id).filter(Boolean);
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select('fullName username').lean() : [];
    const nameById = new Map(users.map((u: any) => [String(u._id), u.fullName || u.username]));

    return rows.map((r: any) => ({
      cashierId: String(r._id),
      name: nameById.get(String(r._id)) || 'Unknown',
      orders: r.orders,
      totalNet: Math.round((r.totalNet || 0) * 100) / 100,
      totalDue: Math.round((r.totalDue || 0) * 100) / 100,
    }));
  }

  // ───────────────── category / brand / group wise sales ─────────────────

  /** $match stage shared by the dimension reports (org + date range). */
  private dimensionMatch(startDate?: string, endDate?: string, orgId?: string): Record<string, any> {
    const match: Record<string, any> = {};
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);
    if (startDate || endDate) {
      match.createdAt = {} as Record<string, Date>;
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    return match;
  }

  /**
   * Shared aggregation for the three dimension reports. Sale items only carry
   * variantId, so the product (and from it the category/brand/group) is looked
   * up through products.variants._id.
   */
  private async dimensionSalesReport(
    dimension: 'category' | 'brand' | 'group',
    startDate?: string,
    endDate?: string,
    orgId?: string
  ) {
    const pipeline: any[] = [
      { $match: this.dimensionMatch(startDate, endDate, orgId) },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.variantId',
          foreignField: 'variants._id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    ];

    if (dimension === 'group') {
      // products.groups is an array — one row per group the product belongs to
      pipeline.push({ $unwind: { path: '$product.groups', preserveNullAndEmptyArrays: true } });
      pipeline.push({
        $lookup: { from: 'product_groups', localField: 'product.groups', foreignField: '_id', as: 'dim' },
      });
    } else {
      const foreignField = dimension === 'category' ? 'categoryId' : 'brandId';
      const from = dimension === 'category' ? 'categories' : 'brands';
      pipeline.push({
        $lookup: { from, localField: `product.${foreignField}`, foreignField: '_id', as: 'dim' },
      });
    }

    pipeline.push({ $unwind: { path: '$dim', preserveNullAndEmptyArrays: true } });

    const fallbackLabel = dimension === 'category' ? 'Uncategorised' : dimension === 'brand' ? 'No Brand' : 'Ungrouped';
    const nameKey = dimension === 'category' ? 'categoryName' : dimension === 'brand' ? 'brandName' : 'groupName';

    pipeline.push({
      $group: {
        _id: '$dim._id',
        name: { $first: { $ifNull: ['$dim.name', fallbackLabel] } },
        totalQty: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.lineTotal' },
        totalCost: { $sum: { $multiply: ['$items.quantity', '$items.unitCostPrice'] } },
        variantIds: { $addToSet: '$items.variantId' },
      },
    });
    pipeline.push({
      $addFields: {
        grossProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
        productCount: { $size: '$variantIds' },
      },
    });
    pipeline.push({
      $addFields: {
        profitMarginPercent: {
          $cond: [
            { $gt: ['$totalRevenue', 0] },
            { $multiply: [{ $divide: ['$grossProfit', '$totalRevenue'] }, 100] },
            0,
          ],
        },
      },
    });
    pipeline.push({ $sort: { totalRevenue: -1 } });

    const rows = await Sale.aggregate(pipeline);
    const round = (n: number) => Math.round((n || 0) * 100) / 100;

    const data = rows.map((r: any) => ({
      id: r._id ? String(r._id) : null,
      name: r.name,
      [nameKey]: r.name, // convenience alias (categoryName / brandName / groupName)
      totalQty: round(r.totalQty),
      totalRevenue: round(r.totalRevenue),
      totalCost: round(r.totalCost),
      grossProfit: round(r.grossProfit),
      profitMarginPercent: Math.round((r.profitMarginPercent || 0) * 10) / 10,
      productCount: r.productCount || 0,
    }));

    const totalRevenue = round(data.reduce((n: number, r: any) => n + r.totalRevenue, 0));
    const totalProfit = round(data.reduce((n: number, r: any) => n + r.grossProfit, 0));
    const topKey = dimension === 'category' ? 'topCategory' : dimension === 'brand' ? 'topBrand' : 'topGroup';

    return {
      summary: {
        totalRevenue,
        totalProfit,
        [topKey]: data[0]?.name || null,
      },
      data,
    };
  }

  /** Sales grouped by product category. */
  async getCategoryWiseSalesReport(startDate?: string, endDate?: string, orgId?: string) {
    return this.dimensionSalesReport('category', startDate, endDate, orgId);
  }

  /** Sales grouped by brand — products without a brand fall under "No Brand". */
  async getBrandWiseSalesReport(startDate?: string, endDate?: string, orgId?: string) {
    return this.dimensionSalesReport('brand', startDate, endDate, orgId);
  }

  /** Sales grouped by product group (products.groups) — ungrouped items are kept. */
  async getGroupWiseSalesReport(startDate?: string, endDate?: string, orgId?: string) {
    return this.dimensionSalesReport('group', startDate, endDate, orgId);
  }

  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────── inventory intelligence reports ───────────────────────

  /**
   * Full trace of one barcode/SKU: product info, every stock movement and the
   * purchased/sold/adjusted totals.
   */
  async getBarcodeWiseReport(barcode?: string, startDate?: string, endDate?: string, orgId?: string) {
    const code = (barcode || '').trim();
    if (!code) throw new AppError(400, 'BARCODE_REQUIRED', 'A barcode or SKU is required');

    const filter: Record<string, any> = {
      $or: [{ 'variants.barcode': code }, { 'variants.sku': code.toUpperCase() }],
    };
    if (orgId && Types.ObjectId.isValid(orgId)) filter.orgId = new Types.ObjectId(orgId);

    const product: any = await Product.findOne(filter)
      .populate('categoryId', 'name')
      .populate('brandId', 'name')
      .lean();
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `No product found for "${code}"`);

    const variant: any =
      product.variants.find((v: any) => v.barcode === code) ||
      product.variants.find((v: any) => v.sku === code.toUpperCase()) ||
      product.variants[0];

    const moveFilter: Record<string, any> = { variantId: variant._id };
    if (startDate || endDate) {
      moveFilter.createdAt = {};
      if (startDate) moveFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        moveFilter.createdAt.$lte = end;
      }
    }

    const movements = await StockMovement.find(moveFilter).sort({ createdAt: 1 }).lean();
    const round = (n: number) => Math.round((n || 0) * 100) / 100;

    const qtyInTypes = ['IN', 'RETURN'];
    let totalPurchased = 0;
    let totalSold = 0;
    let totalAdjusted = 0;

    const rows = movements.map((m: any) => {
      const qtyIn = qtyInTypes.includes(m.type) ? m.quantity : 0;
      const qtyOut = !qtyInTypes.includes(m.type) && m.type !== 'ADJUSTMENT' ? m.quantity : 0;

      if (m.type === 'IN') totalPurchased = round(totalPurchased + m.quantity);
      if (m.type === 'ADJUSTMENT') totalAdjusted = round(totalAdjusted + m.quantity);
      if (m.type === 'OUT' && m.referenceType === 'SALE') totalSold = round(totalSold + m.quantity);

      return {
        date: m.createdAt,
        type: m.type,
        qtyIn,
        qtyOut,
        reference: `${m.referenceType}${m.reason ? ` · ${m.reason}` : ''}`,
        balanceAfter: round(m.stockAfter),
      };
    });

    const openingStock = rows.length > 0 ? round(movements[0].stockBefore) : round(variant.currentStock);
    const closingStock = rows.length > 0 ? round(movements[movements.length - 1].stockAfter) : round(variant.currentStock);

    return {
      product: {
        name: product.name,
        sku: variant.sku,
        barcode: variant.barcode || null,
        variantName: variant.attributeName,
        category: (product.categoryId as any)?.name || '—',
        brand: (product.brandId as any)?.name || 'No Brand',
        unit: product.unit,
        currentStock: round(variant.currentStock),
        costPrice: round(variant.costPrice),
        retailPrice: round(variant.retailSellingPrice),
        wholesalePrice: round(variant.wholesaleSellingPrice),
      },
      movements: rows,
      summary: {
        totalPurchased,
        totalSold,
        totalAdjusted,
        openingStock,
        closingStock,
        stockValue: round(variant.currentStock * variant.costPrice),
      },
    };
  }

  /** Products at or below their alert quantity (or an explicit threshold). */
  async getLowStockReport(threshold?: number, orgId?: string) {
    const match: Record<string, any> = { isActive: true };
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);

    const explicit = threshold !== undefined && !Number.isNaN(Number(threshold));
    const rows = await Product.aggregate([
      { $match: match },
      { $unwind: '$variants' },
      {
        $match: explicit
          ? { 'variants.currentStock': { $lte: Number(threshold) } }
          : { $expr: { $lte: ['$variants.currentStock', '$variants.alertQty'] } },
      },
      {
        // Supplier of the newest purchase order that contains this variant
        $lookup: {
          from: 'purchase_orders',
          let: { vid: '$variants._id' },
          pipeline: [
            { $match: { $expr: { $in: ['$$vid', '$items.variantId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'suppliers', localField: 'supplierId', foreignField: '_id', as: 'sup' } },
            { $project: { supplier: { $arrayElemAt: ['$sup.companyName', 0] } } },
          ],
          as: 'lastPO',
        },
      },
      { $lookup: { from: 'suppliers', localField: 'supplierId', foreignField: '_id', as: 'defaultSup' } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
      { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brd' } },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$name',
          sku: '$variants.sku',
          barcode: { $ifNull: ['$variants.barcode', null] },
          variantName: '$variants.attributeName',
          category: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, '—'] },
          brand: { $ifNull: [{ $arrayElemAt: ['$brd.name', 0] }, 'No Brand'] },
          unit: 1,
          currentStock: '$variants.currentStock',
          alertQty: '$variants.alertQty',
          costPrice: '$variants.costPrice',
          stockValue: { $multiply: ['$variants.currentStock', '$variants.costPrice'] },
          lastSupplier: {
            $ifNull: [
              { $arrayElemAt: ['$lastPO.supplier', 0] },
              { $ifNull: [{ $arrayElemAt: ['$defaultSup.companyName', 0] }, null] },
            ],
          },
        },
      },
      { $sort: { currentStock: 1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        totalItems: rows.length,
        outOfStock: rows.filter((r: any) => (r.currentStock || 0) <= 0).length,
        totalStockValue: round(rows.reduce((n: number, r: any) => n + (r.stockValue || 0), 0)),
      },
      data: rows.map((r: any) => ({ ...r, currentStock: round(r.currentStock), stockValue: round(r.stockValue) })),
    };
  }

  /** Stock that has not sold within the window — money sitting on the shelf. */
  async getDeadStockReport(daysSinceLastSale = 90, orgId?: string) {
    const days = Number.isFinite(Number(daysSinceLastSale)) ? Number(daysSinceLastSale) : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const match: Record<string, any> = { isActive: true };
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);

    const rows = await Product.aggregate([
      { $match: match },
      { $unwind: '$variants' },
      { $match: { 'variants.currentStock': { $gt: 0 } } },
      {
        $lookup: {
          from: 'stock_movements',
          let: { vid: '$variants._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$variantId', '$$vid'] },
                    { $eq: ['$type', 'OUT'] },
                    { $eq: ['$referenceType', 'SALE'] },
                  ],
                },
              },
            },
            { $group: { _id: null, lastSaleAt: { $max: '$createdAt' }, totalSold: { $sum: '$quantity' } } },
          ],
          as: 'sales',
        },
      },
      {
        $addFields: {
          lastSaleAt: { $arrayElemAt: ['$sales.lastSaleAt', 0] },
          totalSoldEver: { $ifNull: [{ $arrayElemAt: ['$sales.totalSold', 0] }, 0] },
        },
      },
      { $match: { $or: [{ lastSaleAt: null }, { lastSaleAt: { $lt: cutoff } }] } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
      { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brd' } },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$name',
          sku: '$variants.sku',
          barcode: { $ifNull: ['$variants.barcode', null] },
          variantName: '$variants.attributeName',
          category: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, '—'] },
          brand: { $ifNull: [{ $arrayElemAt: ['$brd.name', 0] }, 'No Brand'] },
          unit: 1,
          currentStock: '$variants.currentStock',
          costPrice: '$variants.costPrice',
          deadValue: { $multiply: ['$variants.currentStock', '$variants.costPrice'] },
          lastSaleAt: 1,
          totalSoldEver: 1,
        },
      },
      { $sort: { deadValue: -1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const now = Date.now();
    const data = rows.map((r: any) => ({
      ...r,
      currentStock: round(r.currentStock),
      costPrice: round(r.costPrice),
      deadValue: round(r.deadValue),
      daysSinceLastSale: r.lastSaleAt ? Math.floor((now - new Date(r.lastSaleAt).getTime()) / 86400000) : null,
    }));

    return {
      summary: {
        daysSinceLastSale: days,
        totalItems: data.length,
        totalDeadValue: round(data.reduce((n: number, r: any) => n + r.deadValue, 0)),
        totalQty: round(data.reduce((n: number, r: any) => n + r.currentStock, 0)),
      },
      data,
    };
  }

  /**
   * Reorder suggestions for low-stock items: two months of cover based on the
   * last 90 days of sales, with supplier and last purchase price.
   */
  async getStockReorderReport(orgId?: string) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const match: Record<string, any> = { isActive: true };
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);

    const rows = await Product.aggregate([
      { $match: match },
      { $unwind: '$variants' },
      { $match: { $expr: { $lte: ['$variants.currentStock', '$variants.alertQty'] } } },
      {
        $lookup: {
          from: 'stock_movements',
          let: { vid: '$variants._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$variantId', '$$vid'] },
                    { $eq: ['$type', 'OUT'] },
                    { $eq: ['$referenceType', 'SALE'] },
                    { $gte: ['$createdAt', since] },
                  ],
                },
              },
            },
            { $group: { _id: null, sold: { $sum: '$quantity' } } },
          ],
          as: 'sales90',
        },
      },
      {
        $lookup: {
          from: 'purchase_orders',
          let: { vid: '$variants._id' },
          pipeline: [
            { $match: { $expr: { $in: ['$$vid', '$items.variantId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $unwind: '$items' },
            { $match: { $expr: { $eq: ['$items.variantId', '$$vid'] } } },
            { $lookup: { from: 'suppliers', localField: 'supplierId', foreignField: '_id', as: 'sup' } },
            {
              $project: {
                lastPrice: '$items.unitCost',
                supplier: { $arrayElemAt: ['$sup.companyName', 0] },
              },
            },
          ],
          as: 'lastPO',
        },
      },
      { $lookup: { from: 'suppliers', localField: 'supplierId', foreignField: '_id', as: 'defaultSup' } },
      {
        $addFields: {
          sold90: { $ifNull: [{ $arrayElemAt: ['$sales90.sold', 0] }, 0] },
          lastPrice: { $ifNull: [{ $arrayElemAt: ['$lastPO.lastPrice', 0] }, '$variants.costPrice'] },
          supplier: {
            $ifNull: [
              { $arrayElemAt: ['$lastPO.supplier', 0] },
              { $ifNull: [{ $arrayElemAt: ['$defaultSup.companyName', 0] }, null] },
            ],
          },
        },
      },
      {
        $addFields: {
          avgDailySales: { $divide: ['$sold90', 90] },
          avgMonthlySales: { $divide: ['$sold90', 3] },
        },
      },
      {
        $addFields: {
          suggestedQty: {
            $max: [{ $ceil: { $multiply: ['$avgMonthlySales', 2] } }, 1],
          },
          daysLeft: {
            $cond: [
              { $gt: ['$avgDailySales', 0] },
              { $floor: { $divide: ['$variants.currentStock', '$avgDailySales'] } },
              null,
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$name',
          sku: '$variants.sku',
          barcode: { $ifNull: ['$variants.barcode', null] },
          variantName: '$variants.attributeName',
          unit: 1,
          currentStock: '$variants.currentStock',
          alertQty: '$variants.alertQty',
          avgDailySales: 1,
          avgMonthlySales: 1,
          daysLeft: 1,
          suggestedQty: 1,
          supplier: 1,
          lastPurchasePrice: '$lastPrice',
          estimatedCost: { $multiply: ['$suggestedQty', '$lastPrice'] },
        },
      },
      { $sort: { daysLeft: 1, estimatedCost: -1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = rows.map((r: any) => ({
      ...r,
      currentStock: round(r.currentStock),
      avgDailySales: Math.round((r.avgDailySales || 0) * 100) / 100,
      avgMonthlySales: Math.round((r.avgMonthlySales || 0) * 100) / 100,
      lastPurchasePrice: round(r.lastPurchasePrice),
      estimatedCost: round(r.estimatedCost),
    }));

    return {
      summary: {
        totalItems: data.length,
        totalEstimatedCost: round(data.reduce((n: number, r: any) => n + r.estimatedCost, 0)),
      },
      data,
    };
  }

  // ───────────────── inventory by category / brand / group / age ─────────────────

  /** Shared $lookup + $group for the by-category and by-brand inventory views. */
  private async inventoryByDimension(
    dimension: 'category' | 'brand',
    filterId: string | undefined,
    orgId?: string
  ) {
    const match: Record<string, any> = { isActive: true };
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);

    const isCategory = dimension === 'category';
    const dimensionField = isCategory ? 'categoryId' : 'brandId';
    const collection = isCategory ? 'categories' : 'brands';
    const fallbackLabel = isCategory ? 'Uncategorised' : 'No Brand';
    const idKey = isCategory ? 'categoryId' : 'brandId';
    const nameKey = isCategory ? 'category' : 'brand';

    const pipeline: any[] = [
      { $match: match },
      { $unwind: '$variants' },
    ];

    if (filterId) {
      if (!Types.ObjectId.isValid(filterId)) throw new AppError(400, 'INVALID_ID', 'Invalid filter ID');
      pipeline.push({ $match: { [dimensionField]: new Types.ObjectId(filterId) } });
    }

    pipeline.push(
      { $lookup: { from: collection, localField: dimensionField, foreignField: '_id', as: 'dim' } },
      { $unwind: { path: '$dim', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          productName: '$name',
          variantId: '$variants._id',
          variantName: '$variants.attributeName',
          sku: '$variants.sku',
          barcode: { $ifNull: ['$variants.barcode', null] },
          unit: 1,
          currentStock: '$variants.currentStock',
          alertQty: '$variants.alertQty',
          costPrice: '$variants.costPrice',
          retailPrice: '$variants.retailSellingPrice',
          assetValue: { $multiply: ['$variants.currentStock', '$variants.costPrice'] },
          retaiilValue: { $multiply: ['$variants.currentStock', '$variants.retailSellingPrice'] },
          _dimId: '$dim._id',
          [nameKey]: { $ifNull: ['$dim.name', fallbackLabel] },
        },
      }
    );

    const rows = await Product.aggregate(pipeline);
    const round = (n: number) => Math.round((n || 0) * 100) / 100;

    // With a filter: hand back the variants of that one dimension
    if (filterId) {
      const data = rows
        .map((r: any) => ({
          ...r,
          currentStock: round(r.currentStock),
          costPrice: round(r.costPrice),
          retailPrice: round(r.retailPrice),
          assetValue: round(r.assetValue),
          status: r.currentStock <= r.alertQty ? 'LOW_STOCK' : 'OK',
        }))
        .sort((a: any, b: any) => b.assetValue - a.assetValue);

      return {
        summary: {
          totalItems: data.length,
          totalQty: round(data.reduce((n: number, r: any) => n + r.currentStock, 0)),
          totalAssetValue: round(data.reduce((n: number, r: any) => n + r.assetValue, 0)),
          [nameKey]: data[0]?.[nameKey] || null,
        },
        data,
      };
    }

    // Without a filter: one summary row per category/brand
    const map = new Map<string, any>();
    for (const r of rows) {
      const key = r._dimId ? String(r._dimId) : `none-${r[nameKey]}`;
      if (!map.has(key)) {
        map.set(key, {
          id: r._dimId ? String(r._dimId) : null,
          name: r[nameKey],
          productIds: new Set<string>(),
          variantCount: 0,
          totalQty: 0,
          totalAssetValue: 0,
          retailValue: 0,
        });
      }
      const agg = map.get(key);
      agg.productIds.add(String(r.productId));
      agg.variantCount += 1;
      agg.totalQty += r.currentStock || 0;
      agg.totalAssetValue += r.assetValue || 0;
      agg.retailValue += r.retaiilValue || 0;
    }

    const data = Array.from(map.values())
      .map((a) => ({
        id: a.id,
        name: a.name,
        productCount: a.productIds.size,
        variantCount: a.variantCount,
        totalQty: round(a.totalQty),
        totalAssetValue: round(a.totalAssetValue),
        retailValue: round(a.retailValue),
      }))
      .sort((a, b) => b.totalAssetValue - a.totalAssetValue);

    return {
      summary: {
        totalGroups: data.length,
        totalQty: round(data.reduce((n: number, r: any) => n + r.totalQty, 0)),
        totalAssetValue: round(data.reduce((n: number, r: any) => n + r.totalAssetValue, 0)),
      },
      data,
    };
  }

  /** Inventory per category — summary rows, or one category's variants. */
  async getInventoryByCategory(categoryId?: string, orgId?: string) {
    return this.inventoryByDimension('category', categoryId, orgId);
  }

  /** Inventory per brand — summary rows, or one brand's variants. */
  async getInventoryByBrand(brandId?: string, orgId?: string) {
    return this.inventoryByDimension('brand', brandId, orgId);
  }

  /** Inventory summarised by product group (products.groups). */
  async getInventorySummaryByGroup(orgId?: string) {
    const match: Record<string, any> = { isActive: true };
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);

    const rows = await Product.aggregate([
      { $match: match },
      { $unwind: '$variants' },
      { $unwind: { path: '$groups', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'product_groups', localField: 'groups', foreignField: '_id', as: 'grp' } },
      { $unwind: { path: '$grp', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          groupId: '$grp._id',
          name: { $ifNull: ['$grp.name', 'Ungrouped'] },
          currentStock: '$variants.currentStock',
          assetValue: { $multiply: ['$variants.currentStock', '$variants.costPrice'] },
        },
      },
      {
        $group: {
          _id: '$groupId',
          name: { $first: '$name' },
          productIds: { $addToSet: '$productId' },
          totalQty: { $sum: '$currentStock' },
          totalAssetValue: { $sum: '$assetValue' },
        },
      },
      {
        $project: {
          _id: 0,
          id: { $cond: [{ $eq: ['$_id', null] }, null, { $toString: '$_id' }] },
          name: 1,
          productCount: { $size: '$productIds' },
          totalQty: 1,
          totalAssetValue: 1,
        },
      },
      { $sort: { totalAssetValue: -1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = rows.map((r: any) => ({
      ...r,
      totalQty: round(r.totalQty),
      totalAssetValue: round(r.totalAssetValue),
    }));

    return {
      summary: {
        totalGroups: data.length,
        totalQty: round(data.reduce((n: number, r: any) => n + r.totalQty, 0)),
        totalAssetValue: round(data.reduce((n: number, r: any) => n + r.totalAssetValue, 0)),
      },
      data,
    };
  }

  /**
   * Stock aging: how long the current stock has been sitting, based on the
   * newest purchase (IN) movement per variant. 0-30 / 31-60 / 61-90 / 90+.
   */
  async getInventoryAging(orgId?: string) {
    const match: Record<string, any> = { isActive: true };
    if (orgId && Types.ObjectId.isValid(orgId)) match.orgId = new Types.ObjectId(orgId);

    const [result] = await Product.aggregate([
      { $match: match },
      { $unwind: '$variants' },
      { $match: { 'variants.currentStock': { $gt: 0 } } },
      {
        $lookup: {
          from: 'stock_movements',
          let: { vid: '$variants._id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$variantId', '$$vid'] }, { $eq: ['$type', 'IN'] }] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'lastIn',
        },
      },
      {
        $addFields: {
          lastInAt: { $arrayElemAt: ['$lastIn.createdAt', 0] },
        },
      },
      {
        $addFields: {
          ageDays: {
            $floor: {
              $divide: [
                { $subtract: ['$$NOW', { $ifNull: ['$lastInAt', '$createdAt'] }] },
                86400000,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          bucket: {
            $switch: {
              branches: [
                { case: { $lte: ['$ageDays', 30] }, then: '0-30' },
                { case: { $lte: ['$ageDays', 60] }, then: '31-60' },
                { case: { $lte: ['$ageDays', 90] }, then: '61-90' },
              ],
              default: '90+',
            },
          },
        },
      },
      {
        $facet: {
          buckets: [
            {
              $group: {
                _id: '$bucket',
                items: { $sum: 1 },
                totalQty: { $sum: '$variants.currentStock' },
                totalAssetValue: { $sum: { $multiply: ['$variants.currentStock', '$variants.costPrice'] } },
              },
            },
          ],
          items: [
            {
              $project: {
                _id: 0,
                productName: '$name',
                variantName: '$variants.attributeName',
                sku: '$variants.sku',
                unit: 1,
                currentStock: '$variants.currentStock',
                costPrice: '$variants.costPrice',
                assetValue: { $multiply: ['$variants.currentStock', '$variants.costPrice'] },
                ageDays: 1,
                bucket: 1,
                lastPurchaseAt: '$lastInAt',
              },
            },
            { $sort: { ageDays: -1 } },
            { $limit: 500 },
          ],
        },
      },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const ORDER = ['0-30', '31-60', '61-90', '90+'];
    const byBucket = new Map<string, any>((result?.buckets || []).map((b: any) => [b._id, b]));

    const data = ORDER.map((bucket) => {
      const row: any = byBucket.get(bucket);
      return {
        bucket,
        items: row?.items || 0,
        totalQty: round(row?.totalQty || 0),
        totalAssetValue: round(row?.totalAssetValue || 0),
      };
    });

    const items = (result?.items || []).map((r: any) => ({
      ...r,
      currentStock: round(r.currentStock),
      costPrice: round(r.costPrice),
      assetValue: round(r.assetValue),
    }));

    return {
      summary: {
        buckets: data,
        totalItems: items.length,
        totalQty: round(data.reduce((n: number, r: any) => n + r.totalQty, 0)),
        totalAssetValue: round(data.reduce((n: number, r: any) => n + r.totalAssetValue, 0)),
        oldestDays: items.length ? Math.max(...items.map((i: any) => i.ageDays || 0)) : 0,
      },
      data,
      items,
    };
  }

  /**
   * Self-service report: a user's OWN sales, returns and totals. No special
   * permission needed — every user may always see their own numbers.
   */
  async getMySales(userId: string, orgId?: string) {
    const me = new Types.ObjectId(userId);
    const orgMatch: Record<string, any> =
      orgId && Types.ObjectId.isValid(orgId) ? { orgId: new Types.ObjectId(orgId) } : {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, returnAgg, recentSales, mySaleIds, recentReturns] = await Promise.all([
      Sale.aggregate([
        { $match: { ...orgMatch, cashierId: me, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      ]),
      Sale.aggregate([
        { $match: { ...orgMatch, cashierId: me, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      ]),
      Sale.aggregate([
        { $match: { ...orgMatch, cashierId: me, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, returns: { $sum: '$totalAmount' } } },
      ]),
      Sale.find({ cashierId: me }).sort({ createdAt: -1 }).limit(20)
        .populate('customerId', 'name phone')
        .lean(),
      Sale.find({ cashierId: me }).select('_id').limit(5000).lean(),
      (async () => {
        const ids = await Sale.find({ cashierId: me }).select('_id').limit(5000).lean();
        return SalesReturn.find({
          $or: [{ authorizedById: me }, { saleId: { $in: ids.map((s: any) => s._id) } }],
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('saleId', 'invoiceNo')
          .populate('customerId', 'name')
          .populate('authorizedById', 'name')
          .lean();
      })(),
    ]);

    const monthReturnRows = await SalesReturn.aggregate([
      { $match: { ...orgMatch, saleId: { $in: mySaleIds.map((s: any) => s._id) }, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalRefundAmount' } } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;

    return {
      summary: {
        today: { count: todayAgg[0]?.count || 0, total: round(todayAgg[0]?.total || 0) },
        month: { count: monthAgg[0]?.count || 0, total: round(monthAgg[0]?.total || 0) },
        monthReturns: {
          count: monthReturnRows[0]?.count || 0,
          total: round(monthReturnRows[0]?.total || 0),
        },
      },
      recentSales: recentSales,
      recentReturns: recentReturns,
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

  // ══════════════════ Inventory Suite (Phase 8) ══════════════════

  /** Resolves an optional filter into an org-scoped $match for stock movements. */
  private movementMatch(startDate?: string, endDate?: string, extra: Record<string, any> = {}) {
    const match: Record<string, any> = { ...extra };
    if (startDate || endDate) {
      match.createdAt = {} as Record<string, Date>;
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    return match;
  }

  /**
   * Item-wise stock ledger: every movement with a running balance, so a
   * discrepancy can be traced line by line.
   */
  async getStockLedger(
    options: { productId?: string; variantId?: string; startDate?: string; endDate?: string; limit?: number } = {}
  ) {
    if (!options.productId && !options.variantId) {
      throw new AppError(400, 'PRODUCT_REQUIRED', 'A productId or variantId is required for the stock ledger');
    }

    const extra: Record<string, any> = {};
    if (options.productId && Types.ObjectId.isValid(options.productId)) {
      extra.productId = new Types.ObjectId(options.productId);
    }
    if (options.variantId && Types.ObjectId.isValid(options.variantId)) {
      extra.variantId = new Types.ObjectId(options.variantId);
    }

    const movements = await StockMovement.find(this.movementMatch(options.startDate, options.endDate, extra))
      .populate('productId', 'name unit')
      .populate('userId', 'fullName name')
      .sort({ createdAt: 1 })
      .limit(Math.min(options.limit || 500, 2000))
      .lean();

    let balance = 0;
    let totalIn = 0;
    let totalOut = 0;
    const data = movements.map((m: any) => {
      const isIn = m.type === 'IN' || m.type === 'RETURN';
      balance += isIn ? m.quantity : -m.quantity;
      if (isIn) totalIn += m.quantity;
      else totalOut += m.quantity;
      return {
        id: m._id,
        date: m.createdAt,
        productName: m.productId?.name || 'Unknown',
        unit: m.productId?.unit || '',
        type: m.type,
        referenceType: m.referenceType,
        quantity: m.quantity,
        balance: Math.round(balance * 1000) / 1000,
        unitCost: m.unitCost,
        value: Math.round(m.quantity * (m.unitCost || 0) * 100) / 100,
        reason: m.reason,
        user: m.userId?.fullName || m.userId?.name || '',
      };
    });

    return {
      summary: {
        movements: data.length,
        totalIn: Math.round(totalIn * 1000) / 1000,
        totalOut: Math.round(totalOut * 1000) / 1000,
        closingBalance: Math.round(balance * 1000) / 1000,
      },
      data,
    };
  }

  /** Where stock went: totals per movement type plus the biggest movers. */
  async getStockMovementSummary(startDate?: string, endDate?: string) {
    const match = this.movementMatch(startDate, endDate);

    const [byType, topMovers] = await Promise.all([
      StockMovement.aggregate([
        { $match: match },
        {
          $group: {
            _id: { type: '$type', referenceType: '$referenceType' },
            events: { $sum: 1 },
            quantity: { $sum: '$quantity' },
            value: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
          },
        },
        { $sort: { quantity: -1 } },
      ]),
      StockMovement.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$productId',
            inQty: { $sum: { $cond: [{ $in: ['$type', ['IN', 'RETURN']] }, '$quantity', 0] } },
            outQty: { $sum: { $cond: [{ $in: ['$type', ['OUT', 'WASTAGE']] }, '$quantity', 0] } },
          },
        },
        {
          $addFields: {
            netQty: { $subtract: ['$inQty', '$outQty'] },
            totalQty: { $add: ['$inQty', '$outQty'] },
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 15 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'p' } },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            productName: { $arrayElemAt: ['$p.name', 0] },
            unit: { $arrayElemAt: ['$p.unit', 0] },
            inQty: 1,
            outQty: 1,
            netQty: 1,
          },
        },
      ]),
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        totalEvents: byType.reduce((s: number, r: any) => s + r.events, 0),
        totalInQty: byType
          .filter((r: any) => ['IN', 'RETURN'].includes(r._id.type))
          .reduce((s: number, r: any) => s + r.quantity, 0),
        totalOutQty: byType
          .filter((r: any) => ['OUT', 'WASTAGE'].includes(r._id.type))
          .reduce((s: number, r: any) => s + r.quantity, 0),
        totalStockValue: round(byType.reduce((s: number, r: any) => s + (r.value || 0), 0)),
      },
      byType: byType.map((r: any) => ({
        type: r._id.type,
        referenceType: r._id.referenceType,
        events: r.events,
        quantity: round(r.quantity),
        value: round(r.value),
      })),
      topMovers: topMovers.map((r: any) => ({
        ...r,
        inQty: round(r.inQty),
        outQty: round(r.outQty),
        netQty: round(r.netQty),
      })),
    };
  }

  /** Batches already expired or expiring within `days` (FEFO watch list). */
  async getExpiryReport(days = 30) {
    const now = new Date();
    const until = new Date(now.getTime() + Math.max(days, 1) * 24 * 60 * 60 * 1000);

    const rows = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$variants' },
      { $unwind: '$variants.batches' },
      { $match: { 'variants.batches.expiryDate': { $ne: null } } },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$name',
          unit: 1,
          variantId: '$variants._id',
          variantName: '$variants.attributeName',
          sku: '$variants.sku',
          batchNo: '$variants.batches.batchNo',
          expiryDate: '$variants.batches.expiryDate',
          quantity: '$variants.batches.quantity',
          costPrice: '$variants.batches.costPrice',
          stockAtBatchLevel: '$variants.currentStock',
        },
      },
      {
        $addFields: {
          daysLeft: { $floor: { $divide: [{ $subtract: ['$expiryDate', now] }, 86400000] } },
          value: { $multiply: ['$quantity', '$costPrice'] },
        },
      },
      { $match: { expiryDate: { $lte: until } } },
      {
        $addFields: {
          status: { $cond: [{ $lt: ['$expiryDate', now] }, 'EXPIRED', 'EXPIRING_SOON'] },
        },
      },
      { $sort: { expiryDate: 1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const expired = rows.filter((r: any) => r.status === 'EXPIRED');
    return {
      summary: {
        windowDays: days,
        expiredBatches: expired.length,
        expiringBatches: rows.length - expired.length,
        expiredValue: round(expired.reduce((s: number, r: any) => s + r.value, 0)),
        atRiskValue: round(
          rows.filter((r: any) => r.status === 'EXPIRING_SOON').reduce((s: number, r: any) => s + r.value, 0)
        ),
      },
      data: rows.map((r: any) => ({ ...r, quantity: round(r.quantity), value: round(r.value) })),
    };
  }

  /**
   * Same product bought from different suppliers — the spread between their
   * last prices tells you where the next PO should go.
   */
  async getSupplierPriceComparison() {
    const rows = await PurchaseOrder.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { variantId: '$items.variantId', supplierId: '$supplierId' },
          productName: { $last: '$items.productName' },
          sku: { $last: '$items.sku' },
          lastPrice: { $last: '$items.unitCost' },
          minPrice: { $min: '$items.unitCost' },
          maxPrice: { $max: '$items.unitCost' },
          totalQty: { $sum: '$items.receivedQty' },
          orders: { $sum: 1 },
          lastOrderDate: { $max: '$createdAt' },
        },
      },
      {
        $group: {
          _id: '$_id.variantId',
          productName: { $last: '$productName' },
          sku: { $last: '$sku' },
          suppliers: {
            $push: {
              supplierId: '$_id.supplierId',
              lastPrice: '$lastPrice',
              minPrice: '$minPrice',
              maxPrice: '$maxPrice',
              totalQty: '$totalQty',
              orders: '$orders',
              lastOrderDate: '$lastOrderDate',
            },
          },
          cheapest: { $min: '$minPrice' },
          dearest: { $max: '$maxPrice' },
        },
      },
      { $match: { 'suppliers.0': { $exists: true } } },
      { $unwind: '$suppliers' },
      { $lookup: { from: 'suppliers', localField: 'suppliers.supplierId', foreignField: '_id', as: 's' } },
      { $addFields: { 'suppliers.supplierName': { $arrayElemAt: ['$s.companyName', 0] } } },
      { $project: { s: 0 } },
      {
        $group: {
          _id: '$_id',
          productName: { $last: '$productName' },
          sku: { $last: '$sku' },
          cheapest: { $last: '$cheapest' },
          dearest: { $last: '$dearest' },
          suppliers: { $push: '$suppliers' },
        },
      },
      {
        $addFields: {
          savingsIfCheapest: {
            $cond: [
              { $gt: ['$dearest', 0] },
              { $divide: [{ $subtract: ['$dearest', '$cheapest'] }, '$dearest'] },
              0,
            ],
          },
        },
      },
      { $sort: { savingsIfCheapest: -1 } },
      { $limit: 200 },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = rows.map((r: any) => {
      const sorted = [...r.suppliers].sort((a: any, b: any) => a.lastPrice - b.lastPrice);
      return {
        productId: r._id,
        productName: r.productName,
        sku: r.sku,
        cheapestPrice: round(r.cheapest),
        dearestPrice: round(r.dearest),
        spread: round(r.dearest - r.cheapest),
        spreadPercent: Math.round((r.savingsIfCheapest || 0) * 1000) / 10,
        bestSupplier: sorted[0]?.supplierName || null,
        supplierCount: sorted.length,
        suppliers: sorted.map((s: any) => ({
          supplierId: s.supplierId,
          supplierName: s.supplierName,
          lastPrice: round(s.lastPrice),
          minPrice: round(s.minPrice),
          maxPrice: round(s.maxPrice),
          totalQty: round(s.totalQty),
          orders: s.orders,
          lastOrderDate: s.lastOrderDate,
          isCheapest: s.lastPrice === sorted[0]?.lastPrice,
        })),
      };
    });

    return {
      summary: {
        products: data.length,
        multiSupplierProducts: data.filter((d: any) => d.supplierCount > 1).length,
        avgSpreadPercent: data.length
          ? Math.round((data.reduce((s: number, d: any) => s + d.spreadPercent, 0) / data.length) * 10) / 10
          : 0,
      },
      data,
    };
  }

  /**
   * What each supplier actually costs us — order volume, spend, outstanding and
   * how long they take to deliver.
   */
  async getSupplierWisePurchaseReport(startDate?: string, endDate?: string) {
    const match: Record<string, any> = {
      status: { $ne: 'CANCELLED' },
      approvalStatus: { $ne: 'REJECTED' },
    };
    if (startDate || endDate) {
      const range: Record<string, any> = {};
      if (startDate) range.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      match.createdAt = range;
    }

    const rows = await PurchaseOrder.aggregate([
      { $match: match },
      {
        $addFields: {
          orderQty: { $sum: '$items.orderedQty' },
          receivedQty: { $sum: '$items.receivedQty' },
          // Only received orders have a lead time; the rest stay null and $avg skips them.
          leadTimeDays: {
            $cond: [
              { $ne: ['$actualReceivedDate', null] },
              { $divide: [{ $subtract: ['$actualReceivedDate', '$createdAt'] }, 86400000] },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$supplierId',
          poCount: { $sum: 1 },
          orderedQty: { $sum: '$orderQty' },
          receivedQty: { $sum: '$receivedQty' },
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          dueAmount: { $sum: '$dueAmount' },
          avgLeadTimeDays: { $avg: '$leadTimeDays' },
          openOrders: {
            $sum: { $cond: [{ $in: ['$status', ['DRAFT', 'ORDERED', 'PARTIAL']] }, 1, 0] },
          },
          lastOrderDate: { $max: '$createdAt' },
        },
      },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 's' } },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierName: { $ifNull: [{ $arrayElemAt: ['$s.companyName', 0] }, 'Unknown supplier'] },
          phone: { $ifNull: [{ $arrayElemAt: ['$s.phone', 0] }, ''] },
          supplierDue: { $ifNull: [{ $arrayElemAt: ['$s.currentPayableBalance', 0] }, 0] },
          poCount: 1,
          orderedQty: 1,
          receivedQty: 1,
          totalAmount: 1,
          paidAmount: 1,
          dueAmount: 1,
          openOrders: 1,
          lastOrderDate: 1,
          avgLeadTimeDays: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const totalPurchase = rows.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0);
    const totalPaid = rows.reduce((s: number, r: any) => s + (r.paidAmount || 0), 0);
    const totalDue = rows.reduce((s: number, r: any) => s + (r.dueAmount || 0), 0);
    const leadTimes = rows.map((r: any) => r.avgLeadTimeDays).filter((d: any) => typeof d === 'number' && d >= 0);
    const weightedLeadTime = rows.reduce(
      (s: number, r: any) =>
        s + (typeof r.avgLeadTimeDays === 'number' ? r.avgLeadTimeDays * (r.receivedQty || 0) : 0),
      0
    );
    const leadTimeQty = rows.reduce(
      (s: number, r: any) => s + (typeof r.avgLeadTimeDays === 'number' ? r.receivedQty || 0 : 0),
      0
    );

    const data = rows.map((r: any) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      phone: r.phone,
      poCount: r.poCount,
      openOrders: r.openOrders,
      orderedQty: round(r.orderedQty),
      receivedQty: round(r.receivedQty),
      totalAmount: round(r.totalAmount),
      paidAmount: round(r.paidAmount),
      dueAmount: round(r.dueAmount),
      outstanding: round(r.supplierDue),
      revenueShare: totalPurchase > 0 ? Math.round((r.totalAmount / totalPurchase) * 1000) / 10 : 0,
      avgLeadTimeDays: typeof r.avgLeadTimeDays === 'number' ? Math.round(r.avgLeadTimeDays * 10) / 10 : null,
      avgOrderValue: r.poCount ? round(r.totalAmount / r.poCount) : 0,
      lastOrderDate: r.lastOrderDate,
    }));

    return {
      summary: {
        suppliers: data.length,
        totalPurchase: round(totalPurchase),
        totalPaid: round(totalPaid),
        totalDue: round(totalDue),
        openOrders: data.reduce((s: number, d: any) => s + d.openOrders, 0),
        avgLeadTimeDays: leadTimeQty
          ? Math.round((weightedLeadTime / leadTimeQty) * 10) / 10
          : leadTimes.length
          ? Math.round((leadTimes.reduce((s: number, d: number) => s + d, 0) / leadTimes.length) * 10) / 10
          : null,
        topSupplier: data[0]?.supplierName || null,
      },
      data,
    };
  }

  /** Purchases against sales per month + how fast the stock turns over. */
  async getPurchaseVsSalesTurnover(startDate?: string, endDate?: string) {
    const range: Record<string, any> = {};
    if (startDate || endDate) {
      if (startDate) range.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
    }
    const createdMatch = Object.keys(range).length ? { createdAt: range } : {};

    const [salesSeries, purchaseSeries] = await Promise.all([
      Sale.aggregate([
        { $match: createdMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            salesValue: { $sum: '$totalAmount' },
            invoices: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      PurchaseOrder.aggregate([
        { $match: { ...createdMatch, status: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            purchaseValue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const months = Array.from(
      new Set([...salesSeries.map((s: any) => s._id), ...purchaseSeries.map((p: any) => p._id)])
    ).sort();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = months.map((month: string) => {
      const s: any = salesSeries.find((x: any) => x._id === month) || {};
      const p: any = purchaseSeries.find((x: any) => x._id === month) || {};
      const salesValue = round(s.salesValue || 0);
      const purchaseValue = round(p.purchaseValue || 0);
      return {
        month,
        salesValue,
        purchaseValue,
        invoices: s.invoices || 0,
        orders: p.orders || 0,
        ratio: purchaseValue > 0 ? Math.round((salesValue / purchaseValue) * 100) / 100 : null,
        difference: round(salesValue - purchaseValue),
      };
    });

    // Stock turnover: cost of goods sold ÷ average inventory value
    const [cogsAgg, stockAgg] = await Promise.all([
      StockMovement.aggregate([
        { $match: { ...this.movementMatch(startDate, endDate), type: 'OUT', referenceType: 'SALE' } },
        { $group: { _id: null, cogs: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } },
      ]),
      Product.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$variants' },
        {
          $group: {
            _id: null,
            stockValue: { $sum: { $multiply: ['$variants.currentStock', '$variants.costPrice'] } },
          },
        },
      ]),
    ]);

    const cogs = round(cogsAgg[0]?.cogs || 0);
    const stockValue = round(stockAgg[0]?.stockValue || 0);
    return {
      summary: {
        totalSales: round(data.reduce((s: number, d: any) => s + d.salesValue, 0)),
        totalPurchases: round(data.reduce((s: number, d: any) => s + d.purchaseValue, 0)),
        cogs,
        stockValue,
        turnoverRatio: stockValue > 0 ? Math.round((cogs / stockValue) * 100) / 100 : null,
      },
      data,
    };
  }

  /**
   * Reorder suggestions driven by real sales velocity: daily run-rate ×
   * (lead time + safety days) minus what is already on hand.
   */
  async getAutoReorderSuggestion(options: { leadTimeDays?: number; safetyDays?: number; velocityDays?: number } = {}) {
    const velocityDays = Math.min(Math.max(options.velocityDays || 30, 7), 180);
    const leadTimeDays = Math.min(Math.max(options.leadTimeDays || 7, 1), 90);
    const safetyDays = Math.min(Math.max(options.safetyDays || 5, 0), 60);
    const since = new Date(Date.now() - velocityDays * 24 * 60 * 60 * 1000);

    const rows = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$variants' },
      {
        $lookup: {
          from: 'stock_movements',
          let: { vid: '$variants._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$variantId', '$$vid'] },
                    { $eq: ['$type', 'OUT'] },
                    { $eq: ['$referenceType', 'SALE'] },
                    { $gte: ['$createdAt', since] },
                  ],
                },
              },
            },
            { $group: { _id: null, sold: { $sum: '$quantity' } } },
          ],
          as: 'sales',
        },
      },
      { $lookup: { from: 'suppliers', localField: 'supplierId', foreignField: '_id', as: 'sup' } },
      {
        $addFields: {
          sold: { $ifNull: [{ $arrayElemAt: ['$sales.sold', 0] }, 0] },
          supplierName: { $arrayElemAt: ['$sup.companyName', 0] },
        },
      },
      {
        $addFields: {
          avgDailySales: { $divide: ['$sold', velocityDays] },
        },
      },
      {
        $addFields: {
          targetStock: {
            $ceil: {
              $multiply: ['$avgDailySales', leadTimeDays + safetyDays],
            },
          },
          daysLeft: {
            $cond: [
              { $gt: ['$avgDailySales', 0] },
              { $floor: { $divide: ['$variants.currentStock', '$avgDailySales'] } },
              null,
            ],
          },
        },
      },
      {
        $addFields: {
          suggestedQty: { $subtract: ['$targetStock', '$variants.currentStock'] },
        },
      },
      // Only suggest when the branch/org really needs stock
      { $match: { $expr: { $gt: ['$suggestedQty', 0] } } },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$name',
          unit: 1,
          variantId: '$variants._id',
          variantName: '$variants.attributeName',
          sku: '$variants.sku',
          barcode: { $ifNull: ['$variants.barcode', null] },
          currentStock: '$variants.currentStock',
          alertQty: '$variants.alertQty',
          supplierName: 1,
          costPrice: '$variants.costPrice',
          soldInWindow: '$sold',
          avgDailySales: 1,
          daysLeft: 1,
          targetStock: 1,
          suggestedQty: 1,
          priority: {
            $switch: {
              branches: [
                { case: { $eq: ['$variants.currentStock', 0] }, then: 'CRITICAL' },
                { case: { $lte: ['$daysLeft', leadTimeDays] }, then: 'HIGH' },
                { case: { $lte: ['$variables.currentStock', '$variants.alertQty'] }, then: 'MEDIUM' },
              ],
              default: 'LOW',
            },
          },
        },
      },
      { $sort: { daysLeft: 1, suggestedQty: -1 } },
      { $limit: 300 },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = rows.map((r: any) => ({
      ...r,
      currentStock: round(r.currentStock),
      avgDailySales: round(r.avgDailySales),
      suggestedQty: Math.max(Math.ceil(r.suggestedQty || 0), 1),
      estimatedCost: round(Math.max(Math.ceil(r.suggestedQty || 0), 1) * (r.costPrice || 0)),
    }));

    return {
      summary: {
        velocityWindowDays: velocityDays,
        leadTimeDays,
        safetyDays,
        items: data.length,
        critical: data.filter((d: any) => d.priority === 'CRITICAL').length,
        totalEstimatedCost: round(data.reduce((s: number, d: any) => s + d.estimatedCost, 0)),
      },
      data,
    };
  }

  // ══════════════════ Sales register & channel mix (Module 1) ══════════════════

  /** Day-by-day register: invoices, gross, discount, tax, net, tender split, dues. */
  async getDailySalesRegister(startDate?: string, endDate?: string) {
    const match = this.dimensionMatch(startDate, endDate);
    const pipeline: any[] = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          invoices: { $sum: 1 },
          gross: { $sum: { $add: ['$subtotal', '$discountAmount'] } },
          discount: { $sum: '$discountAmount' },
          tax: { $sum: '$totalTax' },
          net: { $sum: '$totalAmount' },
          dues: { $sum: '$dueAmount' },
          items: { $sum: { $size: '$items' } },
          cash: {
            $sum: {
              $sum: {
                $map: {
                  input: { $filter: { input: '$payments', as: 'p', cond: { $eq: ['$$p.method', 'CASH'] } } },
                  as: 'p',
                  in: '$$p.amount',
                },
              },
            },
          },
          card: {
            $sum: {
              $sum: {
                $map: {
                  input: { $filter: { input: '$payments', as: 'p', cond: { $in: ['$$p.method', ['CARD', 'BANK']] } } },
                  as: 'p',
                  in: '$$p.amount',
                },
              },
            },
          },
          mfs: {
            $sum: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$payments',
                      as: 'p',
                      cond: { $in: ['$$p.method', ['BKASH', 'NAGAD', 'ROCKET', 'MFS', 'MOBILE_BANKING']] },
                    },
                  },
                  as: 'p',
                  in: '$$p.amount',
                },
              },
            },
          },
        },
      },
      { $sort: { _id: -1 } },
    ];

    const rows = await Sale.aggregate(pipeline);
    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = rows.map((r: any) => ({
      date: r._id,
      invoices: r.invoices,
      items: r.items,
      gross: round(r.gross),
      discount: round(r.discount),
      tax: round(r.tax),
      net: round(r.net),
      dues: round(r.dues),
      cash: round(r.cash),
      card: round(r.card),
      mfs: round(r.mfs),
      other: round(Math.max(r.net - r.cash - r.card - r.mfs, 0)),
      averageBill: r.invoices ? round(r.net / r.invoices) : 0,
    }));

    return {
      summary: {
        days: data.length,
        invoices: data.reduce((s: number, d: any) => s + d.invoices, 0),
        gross: round(data.reduce((s: number, d: any) => s + d.gross, 0)),
        discount: round(data.reduce((s: number, d: any) => s + d.discount, 0)),
        tax: round(data.reduce((s: number, d: any) => s + d.tax, 0)),
        net: round(data.reduce((s: number, d: any) => s + d.net, 0)),
        dues: round(data.reduce((s: number, d: any) => s + d.dues, 0)),
        bestDay: data.reduce((best: any, d: any) => (!best || d.net > best.net ? d : best), null),
      },
      data,
    };
  }

  /** Retail vs wholesale: volumes, average bill size and share of revenue. */
  async getWholesaleVsRetailReport(startDate?: string, endDate?: string) {
    const match = this.dimensionMatch(startDate, endDate);

    const rows = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$pricingTier',
          invoices: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          discount: { $sum: '$discountAmount' },
          dues: { $sum: '$dueAmount' },
          items: { $sum: { $size: '$items' } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const totalRevenue = rows.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
    const data = rows.map((r: any) => ({
      channel: r._id || 'RETAIL',
      invoices: r.invoices,
      revenue: round(r.revenue),
      discount: round(r.discount),
      dues: round(r.dues),
      items: r.items,
      averageBill: r.invoices ? round(r.revenue / r.invoices) : 0,
      averageItems: r.invoices ? Math.round((r.items / r.invoices) * 10) / 10 : 0,
      revenueShare: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    return {
      summary: {
        totalRevenue: round(totalRevenue),
        totalInvoices: data.reduce((s: number, d: any) => s + d.invoices, 0),
        retail: data.find((d: any) => d.channel === 'RETAIL') || null,
        wholesale: data.find((d: any) => d.channel === 'WHOLESALE') || null,
      },
      data,
    };
  }

  /** Best sellers by quantity and revenue, with each product's share. */
  async getTopSellingProducts(startDate?: string, endDate?: string, limit = 20) {
    const match = this.dimensionMatch(startDate, endDate);
    const rows = await Sale.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.variantId',
          productName: { $last: '$items.productName' },
          sku: { $last: '$items.sku' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: Math.min(Math.max(limit, 1), 100) },
      { $lookup: { from: 'products', localField: '_id', foreignField: 'variants._id', as: 'p' } },
      {
        $project: {
          _id: 0,
          variantId: '$_id',
          productId: { $arrayElemAt: ['$p._id', 0] },
          productName: 1,
          sku: 1,
          unit: { $arrayElemAt: ['$p.unit', 0] },
          quantity: 1,
          revenue: 1,
          orders: 1,
        },
      },
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const totalRevenue = rows.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
    const data = rows.map((r: any, i: number) => ({
      rank: i + 1,
      ...r,
      quantity: round(r.quantity),
      revenue: round(r.revenue),
      revenueShare: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    return {
      summary: {
        products: data.length,
        totalQuantity: round(data.reduce((s: number, d: any) => s + d.quantity, 0)),
        totalRevenue: round(totalRevenue),
      },
      data,
    };
  }

  // ══════════════════ Import / Export (LC) reports (Module 6) ══════════════════

  /** Where every LC stands, its exposure and the deadlines at risk. */
  async getLcStatusReport() {
    return importExportService.getLcStatusReport();
  }

  /** Landed-cost breakdown per imported item, with the margin it leaves. */
  async getLandedCostAnalysis(ciId?: string) {
    return importExportService.getLandedCostAnalysis(ciId);
  }

  /** C&F agent payables summary. */
  async getAgentPayables() {
    return importExportService.getAgentPayables();
  }

  // ══════════════════ Approvals & projects (Module 7) ══════════════════

  /** Everything stuck in an approval chain, with ageing. */
  async getPendingApprovalsReport() {
    const { approvalService } = await import('./ApprovalService');
    return approvalService.getPendingReport();
  }

  /** Project-wise profit & loss. */
  async getProjectProfitAndLoss(projectId?: string) {
    const { projectService } = await import('./ProjectService');
    return projectService.getProfitAndLoss(projectId);
  }

  // ══════════════ eCommerce, CRM & HR (Modules 8-10) ══════════════

  /** Counter sales against online orders, month by month. */
  async getOnlineVsOfflineSales(startDate?: string, endDate?: string) {
    const range: Record<string, any> = {};
    if (startDate || endDate) {
      if (startDate) range.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
    }
    const createdMatch = Object.keys(range).length ? { createdAt: range } : {};

    const [posAgg, onlineAgg] = await Promise.all([
      Sale.aggregate([
        { $match: createdMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            items: { $sum: { $size: '$items' } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      OnlineOrder.aggregate([
        { $match: { ...createdMatch, fulfillmentStatus: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            items: { $sum: { $size: '$items' } },
            delivered: { $sum: { $cond: [{ $eq: ['$fulfillmentStatus', 'DELIVERED'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const months = Array.from(
      new Set([...posAgg.map((r: any) => r._id), ...onlineAgg.map((r: any) => r._id)])
    ).sort() as string[];

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = months.map((month) => {
      const pos: any = posAgg.find((r: any) => r._id === month) || {};
      const web: any = onlineAgg.find((r: any) => r._id === month) || {};
      const posRevenue = round(pos.revenue || 0);
      const onlineRevenue = round(web.revenue || 0);
      const total = posRevenue + onlineRevenue;
      return {
        month,
        posOrders: pos.orders || 0,
        posRevenue,
        posAverageOrder: pos.orders ? round(posRevenue / pos.orders) : 0,
        onlineOrders: web.orders || 0,
        onlineRevenue,
        onlineAverageOrder: web.orders ? round(onlineRevenue / web.orders) : 0,
        onlineDelivered: web.delivered || 0,
        totalRevenue: round(total),
        onlineSharePercent: total > 0 ? Math.round((onlineRevenue / total) * 1000) / 10 : 0,
      };
    });

    const posTotal = round(data.reduce((s, d) => s + d.posRevenue, 0));
    const onlineTotal = round(data.reduce((s, d) => s + d.onlineRevenue, 0));
    return {
      summary: {
        posOrders: data.reduce((s, d) => s + d.posOrders, 0),
        posRevenue: posTotal,
        onlineOrders: data.reduce((s, d) => s + d.onlineOrders, 0),
        onlineRevenue: onlineTotal,
        totalRevenue: round(posTotal + onlineTotal),
        onlineSharePercent: posTotal + onlineTotal > 0 ? Math.round((onlineTotal / (posTotal + onlineTotal)) * 1000) / 10 : 0,
        bestOnlineMonth: data.reduce((best: any, d: any) => (!best || d.onlineRevenue > best.onlineRevenue ? d : best), null),
      },
      data,
    };
  }

  /** How much of the online pipeline actually reaches the customer. */
  async getEcommerceFulfillmentRate(startDate?: string, endDate?: string) {
    const filter: Record<string, any> = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const orders = await OnlineOrder.find(filter)
      .select('orderNo totalAmount paymentStatus fulfillmentStatus courier createdAt updatedAt')
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const byStatus = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((status) => {
      const subset = orders.filter((o: any) => o.fulfillmentStatus === status);
      return {
        status,
        orders: subset.length,
        value: round(subset.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0)),
      };
    });

    const comparable = orders.filter((o: any) => o.fulfillmentStatus !== 'CANCELLED');
    const delivered = orders.filter((o: any) => o.fulfillmentStatus === 'DELIVERED');
    const shippingDays = delivered
      .filter((o: any) => o.courier?.sentAt && o.courier?.deliveredAt)
      .map((o: any) => (new Date(o.courier.deliveredAt).getTime() - new Date(o.courier.sentAt).getTime()) / 86400000);

    const courierMap = new Map<string, { provider: string; orders: number; delivered: number }>();
    for (const o of orders as any[]) {
      if (!o.courier) continue;
      const bucket = courierMap.get(o.courier.provider) || { provider: o.courier.provider, orders: 0, delivered: 0 };
      bucket.orders += 1;
      if (o.courier.status === 'DELIVERED') bucket.delivered += 1;
      courierMap.set(o.courier.provider, bucket);
    }

    return {
      summary: {
        orders: orders.length,
        comparableOrders: comparable.length,
        delivered: delivered.length,
        cancelled: orders.filter((o: any) => o.fulfillmentStatus === 'CANCELLED').length,
        fulfillmentRatePercent: comparable.length ? Math.round((delivered.length / comparable.length) * 1000) / 10 : null,
        cancellationRatePercent: orders.length ? Math.round((orders.filter((o: any) => o.fulfillmentStatus === 'CANCELLED').length / orders.length) * 1000) / 10 : null,
        averageDeliveryDays: shippingDays.length ? round(shippingDays.reduce((s, d) => s + d, 0) / shippingDays.length) : null,
        codPending: round(
          orders
            .filter((o: any) => o.paymentStatus === 'UNPAID' && o.fulfillmentStatus !== 'CANCELLED')
            .reduce((s: number, o: any) => s + (o.totalAmount || 0), 0)
        ),
        onlineRevenue: round(orders.filter((o: any) => o.fulfillmentStatus !== 'CANCELLED').reduce((s: number, o: any) => s + (o.totalAmount || 0), 0)),
      },
      byStatus,
      byCourier: Array.from(courierMap.values()).map((c) => ({
        ...c,
        successRatePercent: c.orders ? Math.round((c.delivered / c.orders) * 1000) / 10 : 0,
      })),
      data: orders.map((o: any) => ({
        id: String(o._id),
        orderNo: o.orderNo,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        courier: o.courier?.provider || '—',
        courierStatus: o.courier?.status || '—',
        trackingCode: o.courier?.trackingCode || '',
        daysToDeliver: o.courier?.sentAt && o.courier?.deliveredAt
          ? round((new Date(o.courier.deliveredAt).getTime() - new Date(o.courier.sentAt).getTime()) / 86400000)
          : null,
      })),
    };
  }

  /** Lead funnel + conversion rate. */
  async getLeadConversionReport(from?: string, to?: string) {
    const { leadService } = await import('./LeadService');
    return leadService.getConversionReport({ from, to });
  }

  /** Support ticket SLA compliance. */
  async getTicketSlaReport(from?: string, to?: string) {
    const { supportTicketService } = await import('./SupportTicketService');
    return supportTicketService.getSlaReport({ from, to });
  }

  /** Approved leave days per employee. */
  async getLeaveSummary(from?: string, to?: string) {
    const { leaveService } = await import('./LeaveService');
    return leaveService.getLeaveSummary({ from, to });
  }

  /** Open shifts, used by the dashboard-style summaries. */
  async getOpenShiftCount() {
    return Shift.countDocuments({ status: 'OPEN' });
  }
}

export const reportService = new ReportService();
