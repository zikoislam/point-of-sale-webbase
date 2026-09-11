import PdfPrinter from 'pdfmake';
import ExcelJS from 'exceljs';
import { reportService } from './ReportService';
import { settingsService, ShopSettings } from './SettingsService';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';

// pdfmake fonts are loaded lazily inside renderPdfToBuffer to avoid crash on module load


// Helper: create pdfmake printer with standard fonts
function createPrinter(): InstanceType<typeof PdfPrinter> {
  const fontDescriptors = {
    Roboto: {
      normal: Buffer.from(''),
      bold: Buffer.from(''),
      italics: Buffer.from(''),
      bolditalics: Buffer.from(''),
    },
  };
  return new PdfPrinter(fontDescriptors);
}

class ExportService {
  // ───────────────────────────── PDF GENERATION ─────────────────────────────

  async generatePdf(
    type: string,
    startDate?: string,
    endDate?: string
  ): Promise<Buffer> {
    const shop = await settingsService.getSettings();
    const { title, content } = await this.buildPdfContent(type, shop, startDate, endDate);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 50],
      defaultStyle: { fontSize: 9, font: 'Roboto' },
      content: [
        // Branded header
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: shop.shopName, fontSize: 16, bold: true, color: '#1e293b' },
                { text: shop.shopAddress, fontSize: 8, color: '#64748b', margin: [0, 2, 0, 0] },
                { text: `Phone: ${shop.shopPhone}${shop.shopEmail ? ` | Email: ${shop.shopEmail}` : ''}`, fontSize: 8, color: '#64748b' },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: title, fontSize: 12, bold: true, alignment: 'right' as const, color: '#334155' },
                {
                  text: `Generated: ${new Date().toLocaleDateString('en-GB')}`,
                  fontSize: 7,
                  alignment: 'right' as const,
                  color: '#94a3b8',
                  margin: [0, 3, 0, 0],
                },
                ...(startDate || endDate
                  ? [
                      {
                        text: `Period: ${startDate || 'All-Time'} → ${endDate || 'Present'}`,
                        fontSize: 7,
                        alignment: 'right' as const,
                        color: '#94a3b8',
                      },
                    ]
                  : []),
              ],
            },
          ],
          margin: [0, 0, 0, 15] as [number, number, number, number],
        },
        // Horizontal rule
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
          margin: [0, 0, 0, 15] as [number, number, number, number],
        },
        // Dynamic content
        ...content,
      ],
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `${shop.shopName} — Confidential`, fontSize: 7, color: '#94a3b8', margin: [40, 0, 0, 0] },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            fontSize: 7,
            color: '#94a3b8',
            alignment: 'right' as const,
            margin: [0, 0, 40, 0],
          },
        ],
      }),
    };

    return this.renderPdfToBuffer(docDefinition);
  }

  private async buildPdfContent(
    type: string,
    shop: ShopSettings,
    startDate?: string,
    endDate?: string
  ): Promise<{ title: string; content: Content[] }> {
    const cur = shop.currencySymbol;

    switch (type) {
      case 'sales': {
        const rep = await reportService.getSalesReport(startDate, endDate);
        return {
          title: 'Sales Summary Report',
          content: [
            this.summaryRow('Total Orders', String(rep.summary.totalOrders)),
            this.summaryRow('Gross Revenue', `${cur}${rep.summary.totalGross.toFixed(2)}`),
            this.summaryRow('Total Tax', `${cur}${rep.summary.totalTax.toFixed(2)}`),
            this.summaryRow('Total Discount', `${cur}${rep.summary.totalDiscount.toFixed(2)}`),
            this.summaryRow('Net Revenue', `${cur}${rep.summary.totalNet.toFixed(2)}`),
            this.summaryRow('Total Paid', `${cur}${rep.summary.totalPaid.toFixed(2)}`),
            this.summaryRow('Total Due', `${cur}${rep.summary.totalDue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto'],
                body: [
                  this.headerRow(['Invoice #', 'Date', 'Gross', 'Tax', 'Discount', 'Net Total', 'Paid', 'Due']),
                  ...rep.data.map((s: any) => [
                    { text: s.invoiceNo, fontSize: 8 },
                    { text: new Date(s.createdAt).toLocaleDateString('en-GB'), fontSize: 8 },
                    { text: `${cur}${s.subtotal?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${s.totalTax?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${s.discountAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${s.totalAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${s.paidAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${s.dueAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, color: s.dueAmount > 0 ? '#dc2626' : '#000' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'products': {
        const items = await reportService.getProductPerformance(startDate, endDate);
        return {
          title: 'Product Performance Report',
          content: [
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product / Variant', 'SKU', 'Units Sold', 'Revenue', 'COGS', 'Gross Profit']),
                  ...items.map((p) => [
                    { text: `${p.productName}\n${p.variantName}`, fontSize: 8 },
                    { text: p.sku, fontSize: 8 },
                    { text: String(p.unitsSold), alignment: 'center' as const, fontSize: 8 },
                    { text: `${cur}${p.revenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${p.cost.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${p.grossProfit.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: p.grossProfit >= 0 ? '#16a34a' : '#dc2626' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'inventory': {
        const rep = await reportService.getInventoryValuation();
        return {
          title: 'Inventory Valuation Report',
          content: [
            this.summaryRow('Total SKUs', String(rep.summary.totalVariants)),
            this.summaryRow('Total Stock Qty', String(rep.summary.totalStockQty)),
            this.summaryRow('Total Asset Value', `${cur}${rep.summary.totalValuation.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product / Variant', 'SKU', 'Cost', 'Retail', 'Stock', 'Asset Value', 'Status']),
                  ...rep.data.map((i) => [
                    { text: `${i.productName}\n${i.variantName}`, fontSize: 8 },
                    { text: i.sku, fontSize: 8 },
                    { text: `${cur}${i.costPrice?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${i.retailPrice?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${i.currentStock} ${i.unit || ''}`, alignment: 'center' as const, fontSize: 8 },
                    { text: `${cur}${i.assetValue?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: i.status, fontSize: 7, color: i.status === 'LOW_STOCK' ? '#dc2626' : '#16a34a' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'pnl': {
        const rep = await reportService.getProfitAndLoss(startDate, endDate);
        return {
          title: 'Profit & Loss Statement',
          content: [
            { text: `Period: ${rep.period.startDate} — ${rep.period.endDate}`, fontSize: 9, color: '#64748b', margin: [0, 0, 0, 10] as [number, number, number, number] },
            this.summaryRow('1. Gross Net Sales Revenue', `+${cur}${rep.revenue.totalSales.toFixed(2)}`),
            this.summaryRow('   Less: COGS', `-${cur}${rep.revenue.cogs.toFixed(2)}`),
            this.summaryRow('(=) Gross Trading Margin', `${cur}${rep.revenue.grossProfit.toFixed(2)} (${rep.revenue.grossMarginPercentage.toFixed(1)}%)`),
            { text: '', margin: [0, 5, 0, 0] as [number, number, number, number] },
            { text: '2. Operating Expenses & Spoilage', fontSize: 10, bold: true, margin: [0, 0, 0, 5] as [number, number, number, number] },
            ...Object.entries(rep.expenses.breakdown || {}).map(([cat, amt]) =>
              this.summaryRow(`   ${cat}`, `-${cur}${(amt as number).toFixed(2)}`)
            ),
            this.summaryRow('Total Operating Overheads', `-${cur}${rep.expenses.totalExpenses.toFixed(2)}`),
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#334155' }], margin: [0, 10, 0, 5] as [number, number, number, number] },
            {
              columns: [
                { text: 'NET OPERATING PROFIT', fontSize: 12, bold: true },
                {
                  text: `${cur}${rep.netProfit.toFixed(2)} (${rep.netProfitMargin}%)`,
                  fontSize: 12,
                  bold: true,
                  alignment: 'right' as const,
                  color: rep.netProfit >= 0 ? '#16a34a' : '#dc2626',
                },
              ],
            },
          ],
        };
      }

      case 'dues': {
        const rep = await reportService.getCustomerDueAging();
        return {
          title: 'Customer Due Aging Report',
          content: [
            this.summaryRow('Customers with Due', String(rep.summary.customersWithDue)),
            this.summaryRow('Total Outstanding', `${cur}${rep.summary.totalOutstandingDue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Customer', 'Phone', 'Credit Limit', 'Current Due', 'Risk']),
                  ...rep.data.map((c) => [
                    { text: c.name, fontSize: 8, bold: true },
                    { text: c.phone, fontSize: 8 },
                    { text: `${cur}${c.creditLimit?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${c.currentDueBalance?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: '#dc2626' },
                    { text: c.riskLevel, fontSize: 7, color: c.riskLevel === 'HIGH_RISK' ? '#dc2626' : '#64748b' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'payables': {
        const rep = await reportService.getSupplierPayables();
        return {
          title: 'Supplier Payables Report',
          content: [
            this.summaryRow('Suppliers with Payable', String(rep.summary.suppliersWithPayable)),
            this.summaryRow('Total Outstanding', `${cur}${rep.summary.totalOutstandingPayable.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Supplier', 'Contact Person', 'Phone', 'Payable Balance']),
                  ...rep.data.map((s) => [
                    { text: s.companyName, fontSize: 8, bold: true },
                    { text: s.contactPerson, fontSize: 8 },
                    { text: s.phone, fontSize: 8 },
                    { text: `${cur}${s.currentPayableBalance?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: '#dc2626' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      default:
        return { title: 'Report', content: [{ text: 'Unknown report type.' }] };
    }
  }

  private headerRow(cells: string[]): TableCell[] {
    return cells.map((c) => ({
      text: c,
      fontSize: 8,
      bold: true,
      color: '#ffffff',
      fillColor: '#334155',
      margin: [4, 6, 4, 6] as [number, number, number, number],
    }));
  }

  private summaryRow(label: string, value: string): Content {
    return {
      columns: [
        { text: label, fontSize: 9, color: '#475569', width: '*' },
        { text: value, fontSize: 9, bold: true, alignment: 'right' as const, width: 'auto' },
      ],
      margin: [0, 2, 0, 2] as [number, number, number, number],
    };
  }

  private renderPdfToBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Use pdfmake's createPdf for virtual font system
        const pdfMakeModule = require('pdfmake/build/pdfmake');
        const vfsFonts = require('pdfmake/build/vfs_fonts');

        // Assign virtual fonts
        if (vfsFonts && vfsFonts.pdfMake) {
          pdfMakeModule.vfs = vfsFonts.pdfMake.vfs;
        }

        const pdfDoc = pdfMakeModule.createPdf(docDefinition);
        pdfDoc.getBuffer((buffer: Buffer) => {
          resolve(Buffer.from(buffer));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ───────────────────────────── EXCEL GENERATION ─────────────────────────────

  async generateExcel(
    type: string,
    startDate?: string,
    endDate?: string
  ): Promise<Buffer> {
    const shop = await settingsService.getSettings();
    const cur = shop.currencySymbol;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = shop.shopName;
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Report');

    // ── Branded Title Row ──
    const titleRow = ws.addRow([shop.shopName]);
    titleRow.font = { size: 14, bold: true, color: { argb: 'FF1E293B' } };
    ws.addRow([`${shop.shopAddress} | ${shop.shopPhone}`]).font = { size: 9, color: { argb: 'FF64748B' } };
    ws.addRow([`Generated: ${new Date().toLocaleDateString('en-GB')}${startDate || endDate ? ` | Period: ${startDate || 'All-Time'} → ${endDate || 'Present'}` : ''}`]).font = {
      size: 9,
      italic: true,
      color: { argb: 'FF94A3B8' },
    };
    ws.addRow([]); // spacer

    switch (type) {
      case 'sales': {
        const rep = await reportService.getSalesReport(startDate, endDate);
        ws.name = 'Sales Summary';

        const headers = ['Invoice #', 'Date', 'Gross', 'Tax', 'Discount', 'Net Total', 'Paid', 'Due'];
        this.addExcelHeaders(ws, headers);

        for (const s of rep.data) {
          ws.addRow([
            s.invoiceNo,
            new Date(s.createdAt).toLocaleDateString('en-GB'),
            s.subtotal,
            s.totalTax,
            s.discountAmount,
            s.totalAmount,
            s.paidAmount,
            s.dueAmount,
          ]);
        }

        // Summary footer row
        ws.addRow([]);
        const sumRow = ws.addRow([
          'TOTALS',
          '',
          rep.summary.totalGross,
          rep.summary.totalTax,
          rep.summary.totalDiscount,
          rep.summary.totalNet,
          rep.summary.totalPaid,
          rep.summary.totalDue,
        ]);
        sumRow.font = { bold: true };
        sumRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });

        this.formatCurrencyColumns(ws, [3, 4, 5, 6, 7, 8], cur);
        break;
      }

      case 'products': {
        const items = await reportService.getProductPerformance(startDate, endDate);
        ws.name = 'Product Performance';

        this.addExcelHeaders(ws, ['Product', 'Variant', 'SKU', 'Units Sold', 'Revenue', 'COGS', 'Gross Profit']);

        for (const p of items) {
          ws.addRow([p.productName, p.variantName, p.sku, p.unitsSold, p.revenue, p.cost, p.grossProfit]);
        }

        this.formatCurrencyColumns(ws, [5, 6, 7], cur);
        break;
      }

      case 'inventory': {
        const rep = await reportService.getInventoryValuation();
        ws.name = 'Inventory Valuation';

        this.addExcelHeaders(ws, ['Product', 'Category', 'Variant', 'SKU', 'Unit', 'Cost Price', 'Retail Price', 'Stock', 'Asset Value', 'Status']);

        for (const i of rep.data) {
          ws.addRow([
            i.productName,
            i.categoryName,
            i.variantName,
            i.sku,
            i.unit,
            i.costPrice,
            i.retailPrice,
            i.currentStock,
            i.assetValue,
            i.status,
          ]);
        }

        // Summary footer
        ws.addRow([]);
        const sumRow = ws.addRow(['TOTALS', '', '', '', '', '', '', rep.summary.totalStockQty, rep.summary.totalValuation, '']);
        sumRow.font = { bold: true };

        this.formatCurrencyColumns(ws, [6, 7, 9], cur);
        break;
      }

      case 'pnl': {
        const rep = await reportService.getProfitAndLoss(startDate, endDate);
        ws.name = 'Profit & Loss';

        this.addExcelHeaders(ws, ['Description', 'Amount']);

        ws.addRow(['Gross Net Sales Revenue', rep.revenue.totalSales]);
        ws.addRow(['Less: Cost of Goods Sold (COGS)', -rep.revenue.cogs]);
        const gpRow = ws.addRow(['Gross Trading Margin', rep.revenue.grossProfit]);
        gpRow.font = { bold: true };
        ws.addRow([]);

        // Expense breakdown
        ws.addRow(['OPERATING EXPENSES']).font = { bold: true };
        for (const [cat, amt] of Object.entries(rep.expenses.breakdown || {})) {
          ws.addRow([`  ${cat}`, -(amt as number)]);
        }
        const totExpRow = ws.addRow(['Total Operating Overheads', -rep.expenses.totalExpenses]);
        totExpRow.font = { bold: true };
        ws.addRow([]);

        const npRow = ws.addRow(['NET OPERATING PROFIT', rep.netProfit]);
        npRow.font = { bold: true, size: 12 };
        npRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rep.netProfit >= 0 ? 'FFD1FAE5' : 'FFFEE2E2' } };
        });

        ws.addRow([`Net Profit Margin: ${rep.netProfitMargin}%`]).font = { italic: true, color: { argb: 'FF64748B' } };

        this.formatCurrencyColumns(ws, [2], cur);
        break;
      }

      case 'dues': {
        const rep = await reportService.getCustomerDueAging();
        ws.name = 'Customer Dues';

        this.addExcelHeaders(ws, ['Customer', 'Phone', 'Credit Limit', 'Current Due', 'Risk Level']);

        for (const c of rep.data) {
          ws.addRow([c.name, c.phone, c.creditLimit, c.currentDueBalance, c.riskLevel]);
        }

        ws.addRow([]);
        const sumRow = ws.addRow(['TOTAL', '', '', rep.summary.totalOutstandingDue, '']);
        sumRow.font = { bold: true };

        this.formatCurrencyColumns(ws, [3, 4], cur);
        break;
      }

      case 'payables': {
        const rep = await reportService.getSupplierPayables();
        ws.name = 'Supplier Payables';

        this.addExcelHeaders(ws, ['Supplier', 'Contact Person', 'Phone', 'Payable Balance']);

        for (const s of rep.data) {
          ws.addRow([s.companyName, s.contactPerson, s.phone, s.currentPayableBalance]);
        }

        ws.addRow([]);
        const sumRow = ws.addRow(['TOTAL', '', '', rep.summary.totalOutstandingPayable]);
        sumRow.font = { bold: true };

        this.formatCurrencyColumns(ws, [4], cur);
        break;
      }

      default: {
        ws.addRow(['Unknown report type']);
      }
    }

    // Auto-width columns
    ws.columns.forEach((col) => {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length + 2 : 10;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen, 40);
    });

    // Freeze the header area (title rows + header)
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5, topLeftCell: 'A6', activeCell: 'A6' }];

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private addExcelHeaders(ws: ExcelJS.Worksheet, headers: string[]): void {
    const row = ws.addRow(headers);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
    row.height = 22;

    // Enable auto-filter on the header row
    const lastCol = String.fromCharCode(64 + headers.length); // A=65
    ws.autoFilter = { from: `A${row.number}`, to: `${lastCol}${row.number}` };
  }

  private formatCurrencyColumns(ws: ExcelJS.Worksheet, colIndices: number[], _cur: string): void {
    for (const idx of colIndices) {
      const col = ws.getColumn(idx);
      col.numFmt = '#,##0.00';
      col.alignment = { horizontal: 'right' };
    }
  }
}

export const exportService = new ExportService();
