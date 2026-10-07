import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/ReportService';
import { exportService } from '../services/ExportService';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

/** Extra query parameters some exports need (barcode / threshold / days / filters). */
function extraExportParams(req: Request): Record<string, string> {
  const extra: Record<string, string> = {};
  for (const key of [
    'barcode',
    'threshold',
    'days',
    'categoryId',
    'subCategoryId',
    'brandId',
    'groupId',
    'color',
    'modelNo',
    'tag',
    'groupBy',
    'productId',
    'variantId',
    'startDate',
    'endDate',
  ]) {
    const value = req.query[key];
    if (value !== undefined && value !== null && String(value) !== '') {
      extra[key] = String(value);
    }
  }
  return extra;
}

class ReportController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data: any = await reportService.getDashboardMetrics();

      // Cashiers get a LIMITED dashboard: no account balances, no stock-at-cost
      // valuation and no supplier payables. Users who can see the P&L (managers,
      // admins) keep the full picture.
      const canSeeFinancials =
        !!req.user?.isPlatformSuperAdmin ||
        (req.user?.permissions || []).includes('reports:pnl');
      if (!canSeeFinancials && data?.kpis) {
        delete data.kpis.liquidCapital;
        delete data.kpis.inventoryValuation;
        delete data.kpis.supplierPayables;
      }

      sendSuccess(res, 200, 'Dashboard metrics fetched', data);
    } catch (err) { next(err); }
  }

  async getSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getSalesReport(startDate as string, endDate as string, req.user?.orgId);
      sendSuccess(res, 200, 'Sales report generated', data);
    } catch (err) { next(err); }
  }

  /** Self-service: the logged-in user's own sales, returns and totals. */
  async getMySales(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getMySales(req.user!.userId, req.user?.orgId);
      sendSuccess(res, 200, 'My sales report generated', data);
    } catch (err) { next(err); }
  }

  async getCategoryWiseSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getCategoryWiseSalesReport(
        startDate as string,
        endDate as string,
        req.user?.orgId
      );
      sendSuccess(res, 200, 'Category-wise sales report generated', data);
    } catch (err) { next(err); }
  }

  async getBrandWiseSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getBrandWiseSalesReport(
        startDate as string,
        endDate as string,
        req.user?.orgId
      );
      sendSuccess(res, 200, 'Brand-wise sales report generated', data);
    } catch (err) { next(err); }
  }

  /**
   * Flexible product report: dropdown filters (category / sub-category / brand /
   * group / colour / model / tag / barcode) plus what to group by (product,
   * variant, barcode, category, brand, group).
   */
  async getProductAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query;
      const data = await reportService.getProductAnalysis({
        startDate: q.startDate as string,
        endDate: q.endDate as string,
        orgId: req.user?.orgId,
        groupBy: q.groupBy as string,
        categoryId: q.categoryId as string,
        subCategoryId: q.subCategoryId as string,
        brandId: q.brandId as string,
        groupId: q.groupId as string,
        color: q.color as string,
        modelNo: q.modelNo as string,
        tag: q.tag as string,
        barcode: q.barcode as string,
      });
      sendSuccess(res, 200, 'Product analysis generated', data);
    } catch (err) { next(err); }
  }

  async getGroupWiseSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getGroupWiseSalesReport(
        startDate as string,
        endDate as string,
        req.user?.orgId
      );
      sendSuccess(res, 200, 'Group-wise sales report generated', data);
    } catch (err) { next(err); }
  }

  /** Trace one barcode/SKU: product info + every stock movement. */
  async getBarcodeWise(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode, startDate, endDate } = req.query;
      const data = await reportService.getBarcodeWiseReport(
        barcode as string,
        startDate as string,
        endDate as string,
        req.user?.orgId
      );
      sendSuccess(res, 200, 'Barcode-wise report generated', data);
    } catch (err) { next(err); }
  }

  async getLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : undefined;
      const data = await reportService.getLowStockReport(threshold, req.user?.orgId);
      sendSuccess(res, 200, 'Low stock report generated', data);
    } catch (err) { next(err); }
  }

  async getDeadStock(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days !== undefined ? Number(req.query.days) : 90;
      const data = await reportService.getDeadStockReport(days, req.user?.orgId);
      sendSuccess(res, 200, 'Dead stock report generated', data);
    } catch (err) { next(err); }
  }

  async getStockReorder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getStockReorderReport(req.user?.orgId);
      sendSuccess(res, 200, 'Stock reorder report generated', data);
    } catch (err) { next(err); }
  }

  async getInventoryByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getInventoryByCategory(req.query.categoryId as string | undefined, req.user?.orgId);
      sendSuccess(res, 200, 'Inventory by category generated', data);
    } catch (err) { next(err); }
  }

  async getInventoryByBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getInventoryByBrand(req.query.brandId as string | undefined, req.user?.orgId);
      sendSuccess(res, 200, 'Inventory by brand generated', data);
    } catch (err) { next(err); }
  }

  async getInventoryByGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getInventorySummaryByGroup(req.user?.orgId);
      sendSuccess(res, 200, 'Inventory by group generated', data);
    } catch (err) { next(err); }
  }

  async getInventoryAging(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getInventoryAging(req.user?.orgId);
      sendSuccess(res, 200, 'Inventory aging report generated', data);
    } catch (err) { next(err); }
  }

  // ── Inventory Suite (Phase 8) ──────────────────────────────────────────────

  async getStockLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, variantId, startDate, endDate, limit } = req.query;
      const data = await reportService.getStockLedger({
        productId: productId as string,
        variantId: variantId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      sendSuccess(res, 200, 'Stock ledger generated', data);
    } catch (err) { next(err); }
  }

  async getStockMovementSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getStockMovementSummary(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Stock movement summary generated', data);
    } catch (err) { next(err); }
  }

  async getExpiryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const data = await reportService.getExpiryReport(days);
      sendSuccess(res, 200, 'Expiry report generated', data);
    } catch (err) { next(err); }
  }

  async getSupplierWisePurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getSupplierWisePurchaseReport(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Supplier-wise purchase report generated', data);
    } catch (err) { next(err); }
  }

  async getSupplierPriceComparison(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getSupplierPriceComparison();
      sendSuccess(res, 200, 'Supplier price comparison generated', data);
    } catch (err) { next(err); }
  }

  async getPurchaseVsSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getPurchaseVsSalesTurnover(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Purchase vs sales turnover generated', data);
    } catch (err) { next(err); }
  }

  async getAutoReorder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getAutoReorderSuggestion({
        leadTimeDays: req.query.leadTimeDays ? parseInt(req.query.leadTimeDays as string) : undefined,
        safetyDays: req.query.safetyDays ? parseInt(req.query.safetyDays as string) : undefined,
        velocityDays: req.query.velocityDays ? parseInt(req.query.velocityDays as string) : undefined,
      });
      sendSuccess(res, 200, 'Auto-reorder suggestions generated', data);
    } catch (err) { next(err); }
  }

  // ── Sales register & channel mix (Module 1) ────────────────────────────────

  async getDailySalesRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getDailySalesRegister(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Daily sales register generated', data);
    } catch (err) { next(err); }
  }

  async getWholesaleVsRetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getWholesaleVsRetailReport(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Wholesale vs retail report generated', data);
    } catch (err) { next(err); }
  }

  async getTopSellingProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, limit } = req.query;
      const data = await reportService.getTopSellingProducts(
        startDate as string,
        endDate as string,
        limit ? parseInt(limit as string) : 20
      );
      sendSuccess(res, 200, 'Top selling products generated', data);
    } catch (err) { next(err); }
  }

  // ── Import / Export (LC) — Module 6 ────────────────────────────────────────

  async getLcStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getLcStatusReport();
      sendSuccess(res, 200, 'LC status report generated', data);
    } catch (err) { next(err); }
  }

  async getLandedCost(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getLandedCostAnalysis(req.query.ciId as string);
      sendSuccess(res, 200, 'Landed cost analysis generated', data);
    } catch (err) { next(err); }
  }

  async getAgentPayables(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getAgentPayables();
      sendSuccess(res, 200, 'C&F agent payables generated', data);
    } catch (err) { next(err); }
  }

  // ── Approvals & projects — Module 7 ────────────────────────────────────────

  async getPendingApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getPendingApprovalsReport();
      sendSuccess(res, 200, 'Pending approvals report generated', data);
    } catch (err) { next(err); }
  }

  async getProjectPnL(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getProjectProfitAndLoss(req.query.projectId as string);
      sendSuccess(res, 200, 'Project P&L generated', data);
    } catch (err) { next(err); }
  }

  // ── eCommerce, CRM & HR — Modules 8-10 ─────────────────────────────────────

  async getOnlineVsOffline(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getOnlineVsOfflineSales(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Online vs offline sales generated', data);
    } catch (err) { next(err); }
  }

  async getFulfillmentRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getEcommerceFulfillmentRate(startDate as string, endDate as string);
      sendSuccess(res, 200, 'eCommerce fulfilment rate generated', data);
    } catch (err) { next(err); }
  }

  async getLeadConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getLeadConversionReport(req.query.startDate as string, req.query.endDate as string);
      sendSuccess(res, 200, 'Lead conversion report generated', data);
    } catch (err) { next(err); }
  }

  async getTicketSla(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getTicketSlaReport(req.query.startDate as string, req.query.endDate as string);
      sendSuccess(res, 200, 'Ticket SLA report generated', data);
    } catch (err) { next(err); }
  }

  async getLeaveSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getLeaveSummary(req.query.startDate as string, req.query.endDate as string);
      sendSuccess(res, 200, 'Leave summary generated', data);
    } catch (err) { next(err); }
  }

  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getProductPerformance(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Product performance report generated', data);
    } catch (err) { next(err); }
  }

  async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getInventoryValuation();
      sendSuccess(res, 200, 'Inventory valuation report generated', data);
    } catch (err) { next(err); }
  }

  async getPnL(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getProfitAndLoss(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Profit & Loss report generated', data);
    } catch (err) { next(err); }
  }

  async getDues(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getCustomerDueAging();
      sendSuccess(res, 200, 'Customer dues report generated', data);
    } catch (err) { next(err); }
  }

  async getPayables(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getSupplierPayables();
      sendSuccess(res, 200, 'Supplier payables report generated', data);
    } catch (err) { next(err); }
  }

  async getPurchases(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getPurchaseReport(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Purchase report generated', data);
    } catch (err) { next(err); }
  }

  async getInventoryWastage(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getInventoryWastageReport(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Inventory wastage report generated', data);
    } catch (err) { next(err); }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const { startDate, endDate } = req.query;

      let csv = '';
      let filename = `report-${type}-${Date.now()}.csv`;

      if (type === 'sales') {
        const rep = await reportService.getSalesReport(startDate as string, endDate as string);
        csv = 'Invoice No,Date,Subtotal,Tax,Discount,Total,Paid,Due\n';
        for (const s of rep.data) {
          csv += `"${s.invoiceNo}","${new Date(s.createdAt).toISOString()}",${s.subtotal},${s.totalTax},${s.discountAmount},${s.totalAmount},${s.paidAmount},${s.dueAmount}\n`;
        }
      } else if (type === 'inventory') {
        const rep = await reportService.getInventoryValuation();
        csv = 'Product,Category,Variant,SKU,Unit,Cost Price,Retail Price,Stock,Asset Value,Status\n';
        for (const i of rep.data) {
          csv += `"${i.productName}","${i.categoryName}","${i.variantName}","${i.sku}","${i.unit}",${i.costPrice},${i.retailPrice},${i.currentStock},${i.assetValue},"${i.status}"\n`;
        }
      } else if (type === 'dues') {
        const rep = await reportService.getCustomerDueAging();
        csv = 'Customer Name,Phone,Credit Limit,Current Due,Risk Level\n';
        for (const c of rep.data) {
          csv += `"${c.name}","${c.phone}",${c.creditLimit},${c.currentDueBalance},"${c.riskLevel}"\n`;
        }
      } else if (type === 'payables') {
        const rep = await reportService.getSupplierPayables();
        csv = 'Supplier Company,Contact Person,Phone,Current Payable Balance\n';
        for (const s of rep.data) {
          csv += `"${s.companyName}","${s.contactPerson}","${s.phone}",${s.currentPayableBalance}\n`;
        }
      } else if (type === 'pnl') {
        const rep = await reportService.getProfitAndLoss(startDate as string, endDate as string);
        csv = 'Section,Line Item,Amount\n';
        csv += `"Revenue","Gross Net Sales",${rep.revenue.totalSales}\n`;
        csv += `"Revenue","Cost of Goods Sold",${rep.revenue.cogs}\n`;
        csv += `"Revenue","Gross Trading Margin",${rep.revenue.grossProfit}\n`;
        for (const [cat, amt] of Object.entries(rep.expenses.breakdown || {})) {
          csv += `"Expenses","${cat}",${amt}\n`;
        }
        csv += `"Expenses","Total Operating Overheads",${rep.expenses.totalExpenses}\n`;
        csv += `"Result","Net Operating Profit",${rep.netProfit}\n`;
      } else if (type === 'purchases') {
        const rep = await reportService.getPurchaseReport(startDate as string, endDate as string);
        csv = 'PO Number,Date,Supplier,Status,Total,Paid,Due\n';
        for (const po of rep.data as any[]) {
          csv += `"${po.poNumber}","${new Date(po.createdAt).toISOString()}","${po.supplierId?.companyName || ''}","${po.status}",${po.totalAmount},${po.paidAmount},${po.dueAmount}\n`;
        }
      } else if (type === 'wastage') {
        const rep = await reportService.getInventoryWastageReport(startDate as string, endDate as string);
        csv = 'Product,Qty,Unit,Unit Cost,Loss Value,Reason,Recorded By,Date\n';
        for (const m of rep.data) {
          csv += `"${m.productName}",${m.quantity},"${m.unit}",${m.unitCost},${m.lossValue},"${(m.reason || '').replace(/"/g, "'")}","${m.recordedBy || ''}","${new Date(m.createdAt).toISOString()}"\n`;
        }
      } else if (type === 'products') {
        const items = await reportService.getProductPerformance(startDate as string, endDate as string);
        csv = 'Product Name,Variant,SKU,Units Sold,Gross Revenue,Cost,Gross Profit\n';
        for (const i of items) {
          csv += `"${i.productName}","${i.variantName}","${i.sku}",${i.unitsSold},${i.revenue},${i.cost},${i.grossProfit}\n`;
        }
      } else if (type === 'category-wise-sales' || type === 'brand-wise-sales' || type === 'group-wise-sales') {
        const rep =
          type === 'category-wise-sales'
            ? await reportService.getCategoryWiseSalesReport(startDate as string, endDate as string, req.user?.orgId)
            : type === 'brand-wise-sales'
            ? await reportService.getBrandWiseSalesReport(startDate as string, endDate as string, req.user?.orgId)
            : await reportService.getGroupWiseSalesReport(startDate as string, endDate as string, req.user?.orgId);
        const label =
          type === 'category-wise-sales' ? 'Category' : type === 'brand-wise-sales' ? 'Brand' : 'Product Group';
        csv = `${label},Qty,Revenue,Cost,Gross Profit,Margin %\n`;
        for (const r of rep.data as any[]) {
          csv += `"${r.name}",${r.totalQty},${r.totalRevenue},${r.totalCost},${r.grossProfit},${r.profitMarginPercent}\n`;
        }
      } else if (type === 'barcode-wise') {
        const rep = await reportService.getBarcodeWiseReport(
          req.query.barcode as string,
          startDate as string,
          endDate as string,
          req.user?.orgId
        );
        csv = 'Date,Type,Qty In,Qty Out,Reference,Balance After\n';
        csv += `"${rep.product.name} (${rep.product.sku})",${rep.product.currentStock},,,,\n`;
        for (const m of rep.movements as any[]) {
          csv += `"${new Date(m.date).toISOString()}","${m.type}",${m.qtyIn || ''},${m.qtyOut || ''},"${m.reference || ''}",${m.balanceAfter}\n`;
        }
      } else if (type === 'low-stock') {
        const rep = await reportService.getLowStockReport(
          req.query.threshold !== undefined ? Number(req.query.threshold) : undefined,
          req.user?.orgId
        );
        csv = 'Product,Variant,SKU,Barcode,Category,Brand,Stock,Alert Qty,Unit,Stock Value,Supplier\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.productName}","${r.variantName || ''}","${r.sku}","${r.barcode || ''}","${r.category}","${r.brand}",${r.currentStock},${r.alertQty},"${r.unit}",${r.stockValue},"${r.lastSupplier || ''}"\n`;
        }
      } else if (type === 'dead-stock') {
        const rep = await reportService.getDeadStockReport(
          req.query.days !== undefined ? Number(req.query.days) : 90,
          req.user?.orgId
        );
        csv = 'Product,Variant,SKU,Category,Brand,Stock,Cost Price,Dead Value,Last Sale,Total Sold Ever\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.productName}","${r.variantName || ''}","${r.sku}","${r.category}","${r.brand}",${r.currentStock},${r.costPrice},${r.deadValue},"${r.lastSaleAt ? new Date(r.lastSaleAt).toISOString() : 'Never'}",${r.totalSoldEver}\n`;
        }
      } else if (type === 'stock-reorder') {
        const rep = await reportService.getStockReorderReport(req.user?.orgId);
        csv = 'Product,Variant,SKU,Stock,Alert Qty,Avg Daily Sales,Avg Monthly Sales,Days Left,Suggested Qty,Supplier,Last Purchase Price,Estimated Cost\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.productName}","${r.variantName || ''}","${r.sku}",${r.currentStock},${r.alertQty},${r.avgDailySales},${r.avgMonthlySales},${r.daysLeft ?? ''},${r.suggestedQty},"${r.supplier || ''}",${r.lastPurchasePrice},${r.estimatedCost}\n`;
        }
      } else if (type === 'inventory-by-category' || type === 'inventory-by-brand') {
        const rep =
          type === 'inventory-by-category'
            ? await reportService.getInventoryByCategory(req.query.categoryId as string | undefined, req.user?.orgId)
            : await reportService.getInventoryByBrand(req.query.brandId as string | undefined, req.user?.orgId);
        const label = type === 'inventory-by-category' ? 'Category' : 'Brand';
        const isSummary = rep.data.length === 0 || 'productCount' in (rep.data[0] as any);
        if (isSummary) {
          csv = `${label},Products,Variants,Qty,Asset Value,Retail Value\n`;
          for (const r of rep.data as any[]) {
            csv += `"${r.name}",${r.productCount ?? 0},${r.variantCount ?? 0},${r.totalQty ?? 0},${r.totalAssetValue ?? 0},${r.retailValue ?? 0}\n`;
          }
        } else {
          csv = 'Product,Variant,SKU,Unit,Stock,Cost,Retail,Asset Value,Status\n';
          for (const r of rep.data as any[]) {
            csv += `"${r.productName}","${r.variantName || ''}","${r.sku}","${r.unit}",${r.currentStock},${r.costPrice},${r.retailPrice},${r.assetValue},"${r.status}"\n`;
          }
        }
      } else if (type === 'inventory-by-group') {
        const rep = await reportService.getInventorySummaryByGroup(req.user?.orgId);
        csv = 'Product Group,Products,Qty,Asset Value\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.name}",${r.productCount ?? 0},${r.totalQty ?? 0},${r.totalAssetValue ?? 0}\n`;
        }
      } else if (type === 'inventory-aging') {
        const rep = await reportService.getInventoryAging(req.user?.orgId);
        csv = 'Age Bucket,Items,Qty,Asset Value\n';
        for (const b of rep.data as any[]) {
          csv += `"${b.bucket} days",${b.items},${b.totalQty},${b.totalAssetValue}\n`;
        }
        csv += '\nProduct,Variant,SKU,Stock,Age (days),Asset Value\n';
        for (const i of rep.items as any[]) {
          csv += `"${i.productName}","${i.variantName || ''}","${i.sku}",${i.currentStock},${i.ageDays},${i.assetValue}\n`;
        }
      } else if (type === 'stock-ledger') {
        const rep = await reportService.getStockLedger({
          productId: req.query.productId as string,
          variantId: req.query.variantId as string,
          startDate: startDate as string,
          endDate: endDate as string,
        });
        csv = 'Date,Item,Type,Source,Quantity,Balance,Unit Cost,Value,Reason,By\n';
        for (const r of rep.data as any[]) {
          csv += `"${new Date(r.date).toISOString()}","${r.productName}","${r.type}","${r.referenceType}",${r.quantity},${r.balance},${r.unitCost},${r.value},"${r.reason || ''}","${r.user || ''}"\n`;
        }
      } else if (type === 'stock-movement-summary') {
        const rep = await reportService.getStockMovementSummary(startDate as string, endDate as string);
        csv = 'Type,Source,Events,Quantity,Value\n';
        for (const r of rep.byType as any[]) {
          csv += `"${r.type}","${r.referenceType}",${r.events},${r.quantity},${r.value}\n`;
        }
        csv += '\nProduct,In,Out,Net\n';
        for (const r of rep.topMovers as any[]) {
          csv += `"${r.productName || '—'}",${r.inQty},${r.outQty},${r.netQty}\n`;
        }
      } else if (type === 'expiry') {
        const rep = await reportService.getExpiryReport(req.query.days ? parseInt(req.query.days as string) : 30);
        csv = 'Product,Variant,SKU,Batch,Expiry,Days Left,Status,Quantity,Value\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.productName}","${r.variantName || ''}","${r.sku || ''}","${r.batchNo || ''}","${new Date(r.expiryDate).toISOString()}",${r.daysLeft},"${r.status}",${r.quantity},${r.value}\n`;
        }
      } else if (type === 'supplier-price-comparison') {
        const rep = await reportService.getSupplierPriceComparison();
        csv = 'Product,SKU,Supplier,Last Price,Min,Max,Quantity,Orders,Cheapest\n';
        for (const p of rep.data as any[]) {
          for (const s of p.suppliers) {
            csv += `"${p.productName}","${p.sku || ''}","${s.supplierName || ''}",${s.lastPrice},${s.minPrice},${s.maxPrice},${s.totalQty},${s.orders},"${s.isCheapest ? 'YES' : ''}"\n`;
          }
        }
      } else if (type === 'purchase-vs-sales') {
        const rep = await reportService.getPurchaseVsSalesTurnover(startDate as string, endDate as string);
        csv = 'Month,Sales,Purchases,Difference,Ratio,Invoices,Orders\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.month}",${r.salesValue},${r.purchaseValue},${r.difference},${r.ratio ?? ''},${r.invoices},${r.orders}\n`;
        }
      } else if (type === 'auto-reorder') {
        const rep = await reportService.getAutoReorderSuggestion({});
        csv = 'Product,Variant,SKU,Stock,Daily Sales,Days Left,Target,Suggested Qty,Supplier,Est Cost,Priority\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.productName}","${r.variantName || ''}","${r.sku || ''}",${r.currentStock},${r.avgDailySales},${r.daysLeft ?? ''},${r.targetStock},${r.suggestedQty},"${r.supplierName || ''}",${r.estimatedCost},"${r.priority}"\n`;
        }
      } else if (type === 'daily-register') {
        const rep = await reportService.getDailySalesRegister(startDate as string, endDate as string);
        csv = 'Date,Invoices,Items,Gross,Discount,Tax,Net,Cash,Card,MFS,Other,Due,Average Bill\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.date}",${r.invoices},${r.items},${r.gross},${r.discount},${r.tax},${r.net},${r.cash},${r.card},${r.mfs},${r.other},${r.dues},${r.averageBill}\n`;
        }
      } else if (type === 'supplier-wise-purchases') {
        const rep = await reportService.getSupplierWisePurchaseReport(startDate as string, endDate as string);
        csv = 'Supplier,Phone,PO Count,Open Orders,Ordered Qty,Received Qty,Total Purchase,Paid,Due,Outstanding,Avg Lead Time (days),Avg Order Value,Share %\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.supplierName}","${r.phone || ''}",${r.poCount},${r.openOrders},${r.orderedQty},${r.receivedQty},${r.totalAmount},${r.paidAmount},${r.dueAmount},${r.outstanding},${r.avgLeadTimeDays ?? ''},${r.avgOrderValue},${r.revenueShare}\n`;
        }
      } else if (type === 'wholesale-vs-retail') {
        const rep = await reportService.getWholesaleVsRetailReport(startDate as string, endDate as string);
        csv = 'Channel,Invoices,Items,Revenue,Discount,Due,Average Bill,Average Items,Revenue Share %\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.channel}",${r.invoices},${r.items},${r.revenue},${r.discount},${r.dues},${r.averageBill},${r.averageItems},${r.revenueShare}\n`;
        }
      } else if (type === 'top-products') {
        const rep = await reportService.getTopSellingProducts(
          startDate as string,
          endDate as string,
          req.query.limit ? parseInt(req.query.limit as string) : 50
        );
        csv = 'Rank,Product,SKU,Unit,Quantity,Revenue,Orders,Revenue Share %\n';
        for (const r of rep.data as any[]) {
          csv += `${r.rank},"${r.productName}","${r.sku || ''}","${r.unit || ''}",${r.quantity},${r.revenue},${r.orders},${r.revenueShare}\n`;
        }
      } else if (type === 'lc-status') {
        const rep = await reportService.getLcStatusReport();
        csv = 'LC No,Type,Status,Beneficiary,Bank,Currency,Amount,Amount BDT,Charges BDT,Outstanding BDT,Issue Date,Latest Shipment,Expiry,Alert\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.lcNumber}","${r.lcType}","${r.status}","${r.beneficiary}","${r.issuingBank}","${r.currency}",${r.lcAmount},${r.lcAmountBdt},${r.totalChargesBdt},${r.outstandingBdt},"${new Date(r.issueDate).toISOString()}","${r.latestShipmentDate ? new Date(r.latestShipmentDate).toISOString() : ''}","${r.expiryDate ? new Date(r.expiryDate).toISOString() : ''}","${r.alert || ''}"\n`;
        }
      } else if (type === 'landed-cost') {
        const rep = await reportService.getLandedCostAnalysis(req.query.ciId as string);
        csv = 'CI No,Supplier,Product,Variant,SKU,Quantity,Goods Cost BDT,Freight,Duty,Other,Landed Unit Cost,Landed Total,Current Cost,Selling Price,Margin,Margin %\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.ciNumber}","${r.supplierName}","${r.productName}","${r.variantName}","${r.sku}",${r.quantity},${r.goodsCostBdt},${r.allocatedFreight},${r.allocatedDuty},${r.allocatedOther},${r.landedUnitCost},${r.landedTotal},${r.currentCostPrice ?? ''},${r.sellingPrice},${r.marginPerUnit},${r.marginPercent ?? ''}\n`;
        }
      } else if (type === 'agent-payables') {
        const rep = await reportService.getAgentPayables();
        csv = 'Agent,Type,Phone,Payable,Active\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.name}","${r.agentType}","${r.phone || ''}",${r.payable},"${r.isActive ? 'YES' : 'NO'}"\n`;
        }
      } else if (type === 'pending-approvals') {
        const rep = await reportService.getPendingApprovalsReport();
        csv = 'Entity,Reference,Title,Amount,Workflow,Level,Requested By,Requested At,Waiting Days\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.entityType}","${r.entityRef}","${r.title}",${r.amount},"${r.workflowName}",${r.currentLevel},${(r.totalLevels)},"${r.requestedBy}","${new Date(r.requestedAt).toISOString()}",${r.waitingDays}\n`;
        }
      } else if (type === 'project-pnl') {
        const rep = await reportService.getProjectProfitAndLoss(req.query.projectId as string);
        csv = 'Code,Project,Status,Customer,Manager,Budget,Revenue,Purchases,Expenses,Total Cost,Profit,Margin %,Budget Used %,Due\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.code}","${r.name}","${r.status}","${r.customerName}","${r.managerName}",${r.budget},${r.revenue},${r.purchases},${r.expenses},${r.totalCost},${r.profit},${r.marginPercent},${r.budgetUsedPercent ?? ''},${r.due}\n`;
        }
      } else if (type === 'online-vs-offline') {
        const rep = await reportService.getOnlineVsOfflineSales(startDate as string, endDate as string);
        csv = 'Month,POS Orders,POS Revenue,POS Avg Order,Online Orders,Online Revenue,Online Avg Order,Total Revenue,Online Share %\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.month}",${r.posOrders},${r.posRevenue},${r.posAverageOrder},${r.onlineOrders},${r.onlineRevenue},${r.onlineAverageOrder},${r.totalRevenue},${r.onlineSharePercent}\n`;
        }
      } else if (type === 'fulfillment-rate') {
        const rep = await reportService.getEcommerceFulfillmentRate(startDate as string, endDate as string);
        csv = 'Order,Date,Amount,Payment,Fulfilment,Courier,Courier Status,Tracking,Days To Deliver\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.orderNo}","${new Date(r.createdAt).toISOString()}",${r.totalAmount},"${r.paymentStatus}","${r.fulfillmentStatus}","${r.courier}","${r.courierStatus}","${r.trackingCode}",${r.daysToDeliver ?? ''}\n`;
        }
      } else if (type === 'lead-conversion') {
        const rep = await reportService.getLeadConversionReport(startDate as string, endDate as string);
        csv = 'Lead No,Name,Phone,Company,Source,Stage,Value,Probability %,Assigned To,Created,Converted,Days In Pipeline\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.leadNo}","${r.name}","${r.phone}","${r.company || ''}","${r.source}","${r.stage}",${r.estimatedValue},${r.probability},"${r.assignedTo}","${new Date(r.createdAt).toISOString()}","${r.convertedAt ? new Date(r.convertedAt).toISOString() : ''}",${r.daysInPipeline}\n`;
        }
      } else if (type === 'ticket-sla') {
        const rep = await reportService.getTicketSlaReport(startDate as string, endDate as string);
        csv = 'Ticket,Subject,Customer,Priority,Status,Assignee,Created,SLA Due,First Response,Resolved,Response Hours,Resolution Hours,SLA Met\n';
        for (const t of rep.data as any[]) {
          csv += `"${t.ticketNo}","${t.subject}","${t.customer}","${t.priority}","${t.status}","${t.assignee}","${new Date(t.createdAt).toISOString()}","${new Date(t.slaDueAt).toISOString()}","${t.firstResponseAt ? new Date(t.firstResponseAt).toISOString() : ''}","${t.resolvedAt ? new Date(t.resolvedAt).toISOString() : ''}",${t.responseHours ?? ''},${t.resolutionHours ?? ''},${t.slaMet === null ? '' : t.slaMet}\n`;
        }
      } else if (type === 'leave-summary') {
        const rep = await reportService.getLeaveSummary(startDate as string, endDate as string);
        csv = 'Employee,Code,Department,Days,Requests,By Type\n';
        for (const r of rep.data as any[]) {
          csv += `"${r.employeeName}","${r.employeeCode}","${r.department}",${r.days},${r.requests},"${Object.entries(r.byType).map(([k, v]) => `${k}:${v}`).join(' ')}"\n`;
        }
      } else if (type === 'product-analysis') {
        const rep = await reportService.getProductAnalysis({
          startDate: startDate as string,
          endDate: endDate as string,
          orgId: req.user?.orgId,
          groupBy: req.query.groupBy as string,
          categoryId: req.query.categoryId as string,
          subCategoryId: req.query.subCategoryId as string,
          brandId: req.query.brandId as string,
          groupId: req.query.groupId as string,
          color: req.query.color as string,
          modelNo: req.query.modelNo as string,
          tag: req.query.tag as string,
          barcode: req.query.barcode as string,
        });
        const labelMap: Record<string, string> = {
          product: 'Product',
          variant: 'Variant',
          barcode: 'Barcode',
          category: 'Category',
          brand: 'Brand',
          group: 'Product Group',
        };
        csv = `${labelMap[rep.groupBy] || 'Product'},Qty,Revenue,Cost,Gross Profit,Margin %\n`;
        for (const r of rep.data) {
          csv += `"${r.name}",${r.totalQty},${r.totalRevenue},${r.totalCost},${r.grossProfit},${r.profitMarginPercent}\n`;
        }
      } else {
        throw new AppError(400, 'UNKNOWN_REPORT_TYPE', `Unknown report type: ${type}`);
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (err) { next(err); }
  }

  // ── PDF Export ──
  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const { startDate, endDate } = req.query;

      const pdfBuffer = await exportService.generatePdf(
        type,
        startDate as string | undefined,
        endDate as string | undefined,
        extraExportParams(req)
      );

      const filename = `report-${type}-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).end(pdfBuffer);
    } catch (err) { next(err); }
  }

  // ── Excel Export ──
  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const { startDate, endDate } = req.query;

      const excelBuffer = await exportService.generateExcel(
        type,
        startDate as string | undefined,
        endDate as string | undefined,
        extraExportParams(req)
      );

      const filename = `report-${type}-${Date.now()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      res.status(200).end(excelBuffer);
    } catch (err) { next(err); }
  }
}

export const reportController = new ReportController();
