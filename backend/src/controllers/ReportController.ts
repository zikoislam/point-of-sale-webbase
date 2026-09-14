import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/ReportService';
import { exportService } from '../services/ExportService';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

class ReportController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportService.getDashboardMetrics();
      sendSuccess(res, 200, 'Dashboard metrics fetched', data);
    } catch (err) { next(err); }
  }

  async getSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await reportService.getSalesReport(startDate as string, endDate as string);
      sendSuccess(res, 200, 'Sales report generated', data);
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
        endDate as string | undefined
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
        endDate as string | undefined
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
