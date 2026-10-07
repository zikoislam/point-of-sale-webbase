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
    endDate?: string,
    extra?: Record<string, string>
  ): Promise<Buffer> {
    const shop = await settingsService.getSettings();
    const { title, content } = await this.buildPdfContent(type, shop, startDate, endDate, extra);

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

  // ─────────────────────── WHOLESALE INVOICE (A4) ───────────────────────────

  /**
   * A proper B2B invoice: letterhead, buyer details (with BIN/TIN), a line table
   * carrying VAT per line, tenders received and signature boxes. Used by the
   * wholesale counter when a dealer buys on account.
   */
  async renderWholesaleInvoice(sale: any, shop: ShopSettings): Promise<Buffer> {
    const cur = shop.currencySymbol;
    const buyer = sale.customerId || {};
    const money = (n: number) => `${cur}${(n || 0).toFixed(2)}`;
    const hasVat = (sale.items || []).some((i: any) => (i.taxAmount || 0) > 0);

    // pdfmake's virtual file system only knows inlined images — handing it a
    // remote URL makes it reject, so a linked logo is simply left off the PDF.
    // (The on-screen invoice shows the logo; the letterhead text always prints.)
    const logo = shop.logoUrl && /^data:image\//i.test(shop.logoUrl) ? shop.logoUrl : null;

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 45, 40, 55],
      defaultStyle: { fontSize: 9, font: 'Roboto' },
      content: [
        // ── Letterhead ──
        {
          columns: [
            {
              width: '*',
              stack: [
                ...(logo ? [{ image: logo, width: 54, margin: [0, 0, 0, 4] as [number, number, number, number] }] : []),
                { text: shop.shopName, fontSize: 15, bold: true, color: '#0f172a' },
                { text: shop.shopAddress, fontSize: 8, color: '#475569', margin: [0, 3, 0, 0] },
                {
                  text: `Phone: ${shop.shopPhone}${shop.shopEmail ? `  |  Email: ${shop.shopEmail}` : ''}`,
                  fontSize: 8,
                  color: '#475569',
                },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'WHOLESALE INVOICE', fontSize: 14, bold: true, alignment: 'right' as const, color: '#1e293b' },
                {
                  text: sale.pricingTier === 'WHOLESALE' ? 'Trade / Dealer Sale' : 'Counter Sale',
                  fontSize: 8,
                  alignment: 'right' as const,
                  color: '#64748b',
                  margin: [0, 2, 0, 0],
                },
                {
                  text: `Invoice No: ${sale.invoiceNo}`,
                  fontSize: 9,
                  bold: true,
                  alignment: 'right' as const,
                  margin: [0, 6, 0, 0],
                },
                {
                  text: `Date: ${new Date(sale.createdAt).toLocaleDateString('en-GB')}`,
                  fontSize: 8,
                  alignment: 'right' as const,
                  color: '#475569',
                },
                {
                  text: `Time: ${new Date(sale.createdAt).toLocaleTimeString('en-GB')}`,
                  fontSize: 8,
                  alignment: 'right' as const,
                  color: '#475569',
                },
              ],
            },
          ],
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.2, lineColor: '#0f172a' }], margin: [0, 0, 0, 10] as [number, number, number, number] },

        // ── Buyer / seller context ──
        {
          columns: [
            {
              width: '60%',
              stack: [
                { text: 'BILL TO', fontSize: 7.5, bold: true, color: '#64748b' },
                { text: buyer.name || 'Walk-in Customer', fontSize: 11, bold: true, margin: [0, 2, 0, 0] },
                ...(buyer.address ? [{ text: buyer.address, fontSize: 8, color: '#475569' }] : []),
                ...(buyer.phone ? [{ text: `Phone: ${buyer.phone}`, fontSize: 8, color: '#475569' }] : []),
                ...(buyer.taxId ? [{ text: `BIN / TIN: ${buyer.taxId}`, fontSize: 8, color: '#475569' }] : []),
              ],
            },
            {
              width: '40%',
              stack: [
                ...(sale.salesRepId?.name ? [{ text: `Sales rep: ${sale.salesRepId.name}`, fontSize: 8 }] : []),
                ...(sale.cashierId?.fullName || sale.cashierId?.username
                  ? [{ text: `Billed by: ${sale.cashierId.fullName || sale.cashierId.username}`, fontSize: 8 }]
                  : []),
                ...(buyer.creditDays
                  ? [{ text: `Credit terms: ${buyer.creditDays} day(s)`, fontSize: 8, color: '#475569' }]
                  : []),
                ...(buyer.currentDueBalance
                  ? [{ text: `Previous balance: ${money(buyer.currentDueBalance)}`, fontSize: 8, color: '#b91c1c' }]
                  : []),
              ],
              alignment: 'right' as const,
            },
          ],
          margin: [0, 0, 0, 12] as [number, number, number, number],
        },

        // ── Line items ──
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', ...(hasVat ? ['auto'] : []), 'auto'],
            body: [
              this.headerRow([
                '#',
                'Product',
                'SKU',
                'Qty',
                'Unit price',
                'Discount',
                ...(hasVat ? ['VAT'] : []),
                'Amount',
              ]),
              ...(sale.items || []).map((item: any, index: number) => [
                { text: String(index + 1), fontSize: 8, alignment: 'center' as const },
                {
                  stack: [
                    { text: item.productName, fontSize: 8, bold: true },
                    ...(item.variantName ? [{ text: item.variantName, fontSize: 7, color: '#64748b' }] : []),
                  ],
                },
                { text: item.sku || '—', fontSize: 7.5, color: '#475569' },
                { text: String(item.quantity), fontSize: 8, alignment: 'right' as const },
                { text: money(item.unitSellingPrice), fontSize: 8, alignment: 'right' as const },
                {
                  text: item.discount > 0 ? `-${money(item.discount)}` : '—',
                  fontSize: 8,
                  alignment: 'right' as const,
                  color: item.discount > 0 ? '#b45309' : '#94a3b8',
                },
                ...(hasVat
                  ? [
                      {
                        text: item.taxAmount > 0 ? `${money(item.taxAmount)} (${item.taxRate || 0}%)` : '—',
                        fontSize: 7.5,
                        alignment: 'right' as const,
                      },
                    ]
                  : []),
                { text: money(item.lineTotal), fontSize: 8, bold: true, alignment: 'right' as const },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },

        // ── Totals + tenders ──
        {
          columns: [
            {
              width: '55%',
              stack: [
                { text: 'PAYMENT RECEIVED', fontSize: 7.5, bold: true, color: '#64748b' },
                ...(sale.payments || []).map((p: any) => ({
                  text: `${String(p.method).replace(/_/g, ' ')}: ${money(p.amount)}${p.transactionRef ? ` (ref ${p.transactionRef})` : ''}`,
                  fontSize: 8,
                  margin: [0, 2, 0, 0] as [number, number, number, number],
                })),
              ],
            },
            {
              width: '45%',
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Subtotal', fontSize: 8 }, { text: money(sale.subtotal), fontSize: 8, alignment: 'right' as const }],
                  ...(sale.discountAmount > 0
                    ? [[{ text: 'Bill discount', fontSize: 8 }, { text: `-${money(sale.discountAmount)}`, fontSize: 8, alignment: 'right' as const }]]
                    : []),
                  ...(sale.totalTax > 0
                    ? [[{ text: 'VAT', fontSize: 8 }, { text: money(sale.totalTax), fontSize: 8, alignment: 'right' as const }]]
                    : []),
                  [
                    { text: 'GRAND TOTAL', fontSize: 9, bold: true },
                    { text: money(sale.totalAmount), fontSize: 10, bold: true, alignment: 'right' as const },
                  ],
                  [{ text: 'Paid', fontSize: 8 }, { text: money(sale.paidAmount), fontSize: 8, alignment: 'right' as const }],
                  ...(sale.changeReturned > 0
                    ? [[{ text: 'Change returned', fontSize: 8 }, { text: money(sale.changeReturned), fontSize: 8, alignment: 'right' as const }]]
                    : []),
                  ...(sale.dueAmount > 0
                    ? [
                        [
                          { text: 'BALANCE DUE', fontSize: 9, bold: true, color: '#b91c1c' },
                          { text: money(sale.dueAmount), fontSize: 9, bold: true, alignment: 'right' as const, color: '#b91c1c' },
                        ],
                      ]
                    : []),
                ],
              },
              layout: 'noBorders',
            },
          ],
          margin: [0, 0, 0, 14] as [number, number, number, number],
        },

        // ── Terms ──
        {
          stack: [
            { text: 'TERMS & CONDITIONS', fontSize: 7.5, bold: true, color: '#64748b', margin: [0, 0, 0, 3] as [number, number, number, number] },
            {
              text: [
                buyer.creditDays
                  ? `Payment: within ${buyer.creditDays} day(s) of this invoice.`
                  : 'Payment: cash / as agreed at the time of sale.',
                ' Goods are sold on the terms agreed between the parties; shortage or damage must be reported within 3 days of receipt.',
                ' This invoice is the proof of purchase — please retain it for any return or adjustment.',
              ].join('\n'),
              fontSize: 7.5,
              color: '#475569',
              lineHeight: 1.35,
            },
          ],
          margin: [0, 0, 0, 24] as [number, number, number, number],
        },

        // ── Signatures ──
        {
          columns: [
            {
              width: '45%',
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.8, lineColor: '#334155' }] },
                { text: 'Authorized Signature', fontSize: 7.5, color: '#64748b', margin: [0, 3, 0, 0] as [number, number, number, number] },
              ],
            },
            { width: '10%', text: '' },
            {
              width: '45%',
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.8, lineColor: '#334155' }] },
                { text: 'Received By (Buyer)', fontSize: 7.5, color: '#64748b', margin: [0, 3, 0, 0] as [number, number, number, number] },
              ],
            },
          ],
        },
      ],
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `${shop.shopName} — Invoice ${sale.invoiceNo}`, fontSize: 7, color: '#94a3b8', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#94a3b8', alignment: 'right' as const, margin: [0, 0, 40, 0] },
        ],
      }),
    };

    return this.renderPdfToBuffer(docDefinition);
  }

  /**
   * A printable trade catalogue: every active product with its wholesale price,
   * grouped by category — what an SR hands to a dealer.
   */
  async renderWholesalePriceList(
    groups: { category: string; rows: { productName: string; sku: string; unit: string; retailPrice: number | null; wholesalePrice: number }[] }[],
    shop: ShopSettings
  ): Promise<Buffer> {
    const cur = shop.currencySymbol;
    const money = (n: number | null) => (n === null || n === undefined ? '—' : `${cur}${n.toFixed(2)}`);
    const totalItems = groups.reduce((s, g) => s + g.rows.length, 0);

    const content: Content[] = [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: shop.shopName, fontSize: 15, bold: true, color: '#0f172a' },
              { text: shop.shopAddress, fontSize: 8, color: '#475569', margin: [0, 3, 0, 0] },
              { text: `Phone: ${shop.shopPhone}${shop.shopEmail ? `  |  Email: ${shop.shopEmail}` : ''}`, fontSize: 8, color: '#475569' },
            ],
          },
          {
            width: 'auto',
            stack: [
              { text: 'WHOLESALE PRICE LIST', fontSize: 13, bold: true, alignment: 'right' as const, color: '#1e293b' },
              { text: `${totalItems} item(s) · ${groups.length} categor(y/ies)`, fontSize: 8, alignment: 'right' as const, color: '#64748b', margin: [0, 3, 0, 0] },
              { text: `Issued: ${new Date().toLocaleDateString('en-GB')}`, fontSize: 8, alignment: 'right' as const, color: '#64748b' },
            ],
          },
        ],
        margin: [0, 0, 0, 12] as [number, number, number, number],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.2, lineColor: '#0f172a' }], margin: [0, 0, 0, 12] as [number, number, number, number] },
    ];

    if (groups.length === 0) {
      content.push({ text: 'No active products to list yet.', fontSize: 9, color: '#64748b' });
    }

    for (const group of groups) {
      content.push(
        { text: group.category.toUpperCase(), fontSize: 10, bold: true, color: '#1e293b', margin: [0, 8, 0, 4] as [number, number, number, number] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              this.headerRow(['Product', 'SKU', 'Unit', 'Retail', 'Wholesale']),
              ...group.rows.map((r) => [
                { text: r.productName, fontSize: 8 },
                { text: r.sku || '—', fontSize: 7.5, color: '#475569' },
                { text: r.unit || '—', fontSize: 8 },
                { text: money(r.retailPrice), fontSize: 8, alignment: 'right' as const, color: '#94a3b8' },
                { text: money(r.wholesalePrice), fontSize: 8.5, bold: true, alignment: 'right' as const },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        }
      );
    }

    content.push({
      text: 'Wholesale prices apply to trade (WHOLESALE / DEALER) accounts. Prices are exclusive of VAT unless stated; subject to change without notice.',
      fontSize: 7.5,
      color: '#64748b',
      margin: [0, 14, 0, 0] as [number, number, number, number],
    });

    return this.renderPdfToBuffer({
      pageSize: 'A4',
      pageMargins: [40, 45, 40, 55],
      defaultStyle: { fontSize: 9, font: 'Roboto' },
      content,
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `${shop.shopName} — Wholesale price list`, fontSize: 7, color: '#94a3b8', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#94a3b8', alignment: 'right' as const, margin: [0, 0, 40, 0] },
        ],
      }),
    });
  }

  private async buildPdfContent(
    type: string,
    shop: ShopSettings,
    startDate?: string,
    endDate?: string,
    extra?: Record<string, string>
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

      case 'purchases': {
        const rep = await reportService.getPurchaseReport(startDate, endDate);
        return {
          title: 'Purchases Summary Report',
          content: [
            this.summaryRow('Purchase Orders', String(rep.summary.totalPurchaseOrders)),
            this.summaryRow('Total Ordered Value', `${cur}${rep.summary.totalOrderedValue.toFixed(2)}`),
            this.summaryRow('Total Paid', `${cur}${rep.summary.totalPaid.toFixed(2)}`),
            this.summaryRow('Total Outstanding', `${cur}${rep.summary.totalDue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['PO #', 'Date', 'Supplier', 'Status', 'Total', 'Paid', 'Due']),
                  ...rep.data.map((po: any) => [
                    { text: po.poNumber, fontSize: 8 },
                    { text: new Date(po.createdAt).toLocaleDateString('en-GB'), fontSize: 8 },
                    { text: po.supplierId?.companyName || '—', fontSize: 8 },
                    { text: po.status, fontSize: 8 },
                    { text: `${cur}${po.totalAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${po.paidAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${po.dueAmount?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, color: po.dueAmount > 0 ? '#dc2626' : '#000' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'wastage': {
        const rep = await reportService.getInventoryWastageReport(startDate, endDate);
        return {
          title: 'Wastage & Shrinkage Report',
          content: [
            this.summaryRow('Wastage Events', String(rep.summary.totalWastageEvents)),
            this.summaryRow('Total Units Written Off', String(rep.summary.totalQty)),
            this.summaryRow('Total Loss Value', `${cur}${rep.summary.totalLossValue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', '*', 'auto'],
                body: [
                  this.headerRow(['Product', 'Qty', 'Unit Cost', 'Loss Value', 'Reason', 'Date']),
                  ...rep.data.map((m: any) => [
                    { text: m.productName, fontSize: 8, bold: true },
                    { text: `${m.quantity} ${m.unit}`, fontSize: 8 },
                    { text: `${cur}${m.unitCost?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${m.lossValue?.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: '#dc2626' },
                    { text: m.reason || '—', fontSize: 8 },
                    { text: new Date(m.createdAt).toLocaleDateString('en-GB'), fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'category-wise-sales': {
        const rep = await reportService.getCategoryWiseSalesReport(startDate, endDate);
        return { title: 'Category-wise Sales Report', content: this.dimensionPdfContent('Category', rep, cur) };
      }

      case 'brand-wise-sales': {
        const rep = await reportService.getBrandWiseSalesReport(startDate, endDate);
        return { title: 'Brand-wise Sales Report', content: this.dimensionPdfContent('Brand', rep, cur) };
      }

      case 'group-wise-sales': {
        const rep = await reportService.getGroupWiseSalesReport(startDate, endDate);
        return { title: 'Group-wise Sales Report', content: this.dimensionPdfContent('Product Group', rep, cur) };
      }

      case 'product-analysis': {
        const rep = await reportService.getProductAnalysis({
          startDate,
          endDate,
          groupBy: extra?.groupBy,
          categoryId: extra?.categoryId,
          subCategoryId: extra?.subCategoryId,
          brandId: extra?.brandId,
          groupId: extra?.groupId,
          color: extra?.color,
          modelNo: extra?.modelNo,
          tag: extra?.tag,
          barcode: extra?.barcode,
        });
        const labels: Record<string, string> = {
          product: 'Product',
          variant: 'Variant',
          barcode: 'Barcode',
          category: 'Category',
          brand: 'Brand',
          group: 'Product Group',
        };
        const label = labels[rep.groupBy] || 'Product';
        return { title: `Product Analysis — by ${label}`, content: this.dimensionPdfContent(label, rep, cur) };
      }

      case 'barcode-wise': {
        const rep = await reportService.getBarcodeWiseReport(extra?.barcode, startDate, endDate);
        const p = rep.product;
        return {
          title: 'Barcode Stock Trace',
          content: [
            this.summaryRow('Product', p.name),
            this.summaryRow('Variant', p.variantName || '—'),
            this.summaryRow('SKU / Barcode', `${p.sku}${p.barcode ? ` · ${p.barcode}` : ''}`),
            this.summaryRow('Category / Brand', `${p.category} · ${p.brand}`),
            this.summaryRow('Cost / Retail / Wholesale', `${cur}${p.costPrice} · ${cur}${p.retailPrice} · ${cur}${p.wholesalePrice}`),
            this.summaryRow('Opening → Closing Stock', `${rep.summary.openingStock} → ${rep.summary.closingStock} ${p.unit}`),
            this.summaryRow('Purchased / Sold / Adjusted', `${rep.summary.totalPurchased} / ${rep.summary.totalSold} / ${rep.summary.totalAdjusted}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', 'auto', '*', 'auto'],
                body: [
                  this.headerRow(['Date', 'Type', 'Qty In', 'Qty Out', 'Reference', 'Balance']),
                  ...rep.movements.map((m: any) => [
                    { text: new Date(m.date).toLocaleDateString('en-GB'), fontSize: 8 },
                    { text: m.type, fontSize: 8 },
                    { text: m.qtyIn ? String(m.qtyIn) : '—', alignment: 'right' as const, fontSize: 8, color: '#16a34a' },
                    { text: m.qtyOut ? String(m.qtyOut) : '—', alignment: 'right' as const, fontSize: 8, color: '#dc2626' },
                    { text: m.reference || '—', fontSize: 8 },
                    { text: String(m.balanceAfter), alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'low-stock': {
        const rep = await reportService.getLowStockReport(extra?.threshold ? Number(extra.threshold) : undefined);
        return {
          title: 'Low Stock Alert Report',
          content: [
            this.summaryRow('Items Below Alert Level', String(rep.summary.totalItems)),
            this.summaryRow('Out of Stock', String(rep.summary.outOfStock)),
            this.summaryRow('Stock Value at Risk', `${cur}${rep.summary.totalStockValue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', '*'],
                body: [
                  this.headerRow(['Product', 'SKU', 'Category', 'Stock', 'Alert', 'Supplier']),
                  ...rep.data.map((r: any) => [
                    { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                    { text: r.sku, fontSize: 8 },
                    { text: r.category, fontSize: 8 },
                    { text: String(r.currentStock), alignment: 'right' as const, fontSize: 8, bold: true, color: r.currentStock <= 0 ? '#dc2626' : '#d97706' },
                    { text: String(r.alertQty), alignment: 'right' as const, fontSize: 8 },
                    { text: r.lastSupplier || '—', fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'dead-stock': {
        const rep = await reportService.getDeadStockReport(extra?.days ? Number(extra.days) : 90);
        return {
          title: 'Dead / Slow-moving Stock Report',
          content: [
            this.summaryRow('No sale within (days)', String(rep.summary.daysSinceLastSale)),
            this.summaryRow('Dead Items', String(rep.summary.totalItems)),
            this.summaryRow('Total Dead Stock Value', `${cur}${rep.summary.totalDeadValue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product', 'SKU', 'Stock', 'Cost', 'Dead Value', 'Last Sale']),
                  ...rep.data.map((r: any) => [
                    { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                    { text: r.sku, fontSize: 8 },
                    { text: String(r.currentStock), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.costPrice.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.deadValue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: '#dc2626' },
                    { text: r.daysSinceLastSale === null ? 'Never' : `${r.daysSinceLastSale}d ago`, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'stock-reorder': {
        const rep = await reportService.getStockReorderReport();
        return {
          title: 'Stock Reorder Suggestion Report',
          content: [
            this.summaryRow('Items to Reorder', String(rep.summary.totalItems)),
            this.summaryRow('Estimated Purchase Cost', `${cur}${rep.summary.totalEstimatedCost.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', '*', 'auto'],
                body: [
                  this.headerRow(['Product', 'Stock', 'Avg/Day', 'Days Left', 'Suggest', 'Supplier', 'Est Cost']),
                  ...rep.data.map((r: any) => [
                    { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                    { text: String(r.currentStock), alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: String(r.avgDailySales), alignment: 'right' as const, fontSize: 8 },
                    { text: r.daysLeft === null ? '—' : String(r.daysLeft), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.suggestedQty), alignment: 'right' as const, fontSize: 8, bold: true, color: '#2563eb' },
                    { text: r.supplier || '—', fontSize: 8 },
                    { text: `${cur}${r.estimatedCost.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'inventory-by-category': {
        const rep = await reportService.getInventoryByCategory(extra?.categoryId);
        return {
          title: extra?.categoryId ? 'Inventory by Category — Details' : 'Inventory by Category — Summary',
          content: this.inventoryPdfContent('Category', rep, cur),
        };
      }

      case 'inventory-by-brand': {
        const rep = await reportService.getInventoryByBrand(extra?.brandId);
        return {
          title: extra?.brandId ? 'Inventory by Brand — Details' : 'Inventory by Brand — Summary',
          content: this.inventoryPdfContent('Brand', rep, cur),
        };
      }

      case 'inventory-by-group': {
        const rep = await reportService.getInventorySummaryByGroup();
        return { title: 'Inventory by Product Group', content: this.inventoryPdfContent('Product Group', rep, cur) };
      }

      case 'inventory-aging': {
        const rep = await reportService.getInventoryAging();
        return {
          title: 'Inventory Aging Report',
          content: [
            this.summaryRow('Total Asset Value', `${cur}${rep.summary.totalAssetValue.toFixed(2)}`),
            this.summaryRow('Total Qty On Hand', String(rep.summary.totalQty)),
            this.summaryRow('Oldest Stock Age', `${rep.summary.oldestDays} days`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Age Bucket', 'Items', 'Qty', 'Asset Value']),
                  ...rep.data.map((b: any) => [
                    { text: `${b.bucket} days`, fontSize: 8, bold: true },
                    { text: String(b.items), alignment: 'right' as const, fontSize: 8 },
                    { text: String(b.totalQty), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${b.totalAssetValue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
            { text: 'Oldest items', fontSize: 10, bold: true, margin: [0, 14, 0, 6] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product', 'SKU', 'Stock', 'Age (days)', 'Value']),
                  ...rep.items.slice(0, 100).map((i: any) => [
                    { text: `${i.productName}\n${i.variantName || ''}`, fontSize: 8 },
                    { text: i.sku, fontSize: 8 },
                    { text: String(i.currentStock), alignment: 'right' as const, fontSize: 8 },
                    { text: String(i.ageDays), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${i.assetValue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      // ── Inventory Suite (Phase 8) ──────────────────────────────────────────

      case 'stock-ledger': {
        const rep = await reportService.getStockLedger({
          productId: extra?.productId,
          variantId: extra?.variantId,
          startDate: extra?.startDate,
          endDate: extra?.endDate,
        });
        return {
          title: 'Stock Ledger',
          content: [
            this.summaryRow('Movements', String(rep.summary.movements)),
            this.summaryRow('Total In', String(rep.summary.totalIn)),
            this.summaryRow('Total Out', String(rep.summary.totalOut)),
            this.summaryRow('Closing Balance', String(rep.summary.closingBalance)),
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Date', 'Item', 'Type', 'Qty', 'Balance', 'Value']),
                  ...rep.data.slice(0, 200).map((r: any) => [
                    { text: new Date(r.date).toLocaleDateString(), fontSize: 8 },
                    { text: `${r.productName}\n${r.reason || ''}`, fontSize: 8 },
                    { text: r.type, fontSize: 8 },
                    { text: String(r.quantity), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.balance), alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${(r.value || 0).toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'stock-movement-summary': {
        const rep = await reportService.getStockMovementSummary(extra?.startDate, extra?.endDate);
        return {
          title: 'Stock Movement Summary',
          content: [
            this.summaryRow('Total Events', String(rep.summary.totalEvents)),
            this.summaryRow('Total In', String(rep.summary.totalInQty)),
            this.summaryRow('Total Out', String(rep.summary.totalOutQty)),
            this.summaryRow('Movement Value', `${cur}${rep.summary.totalStockValue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Type', 'Source', 'Events', 'Qty', 'Value']),
                  ...rep.byType.map((r: any) => [
                    { text: r.type, fontSize: 8, bold: true },
                    { text: r.referenceType, fontSize: 8 },
                    { text: String(r.events), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.quantity), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.value.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
            { text: 'Top movers', fontSize: 10, bold: true, margin: [0, 14, 0, 6] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product', 'In', 'Out', 'Net']),
                  ...rep.topMovers.map((r: any) => [
                    { text: r.productName || '—', fontSize: 8 },
                    { text: String(r.inQty), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.outQty), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.netQty), alignment: 'right' as const, fontSize: 8, bold: true },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'expiry': {
        const rep = await reportService.getExpiryReport(extra?.days ? parseInt(extra.days) : 30);
        return {
          title: `Expiry Report (next ${rep.summary.windowDays} days)`,
          content: [
            this.summaryRow('Expired Batches', String(rep.summary.expiredBatches)),
            this.summaryRow('Expiring Soon', String(rep.summary.expiringBatches)),
            this.summaryRow('Expired Value', `${cur}${rep.summary.expiredValue.toFixed(2)}`),
            this.summaryRow('At-risk Value', `${cur}${rep.summary.atRiskValue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product', 'Batch', 'Expiry', 'Days Left', 'Qty', 'Value']),
                  ...rep.data.slice(0, 200).map((r: any) => [
                    { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                    { text: r.batchNo || '—', fontSize: 8 },
                    { text: new Date(r.expiryDate).toLocaleDateString(), fontSize: 8 },
                    {
                      text: String(r.daysLeft),
                      alignment: 'right' as const,
                      fontSize: 8,
                      color: r.status === 'EXPIRED' ? '#dc2626' : '#d97706',
                      bold: true,
                    },
                    { text: String(r.quantity), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.value.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'supplier-wise-purchases': {
        const rep = await reportService.getSupplierWisePurchaseReport(startDate, endDate);
        return {
          title: 'Supplier-wise Purchase Analysis',
          content: [
            this.summaryRow('Suppliers', String(rep.summary.suppliers)),
            this.summaryRow('Total Purchase Value', `${cur}${rep.summary.totalPurchase.toFixed(2)}`),
            this.summaryRow('Total Paid', `${cur}${rep.summary.totalPaid.toFixed(2)}`),
            this.summaryRow('Outstanding on Orders', `${cur}${rep.summary.totalDue.toFixed(2)}`),
            this.summaryRow('Open Orders', String(rep.summary.openOrders)),
            this.summaryRow(
              'Average Lead Time',
              rep.summary.avgLeadTimeDays === null ? '—' : `${rep.summary.avgLeadTimeDays} days`
            ),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Supplier', 'POs', 'Purchased', 'Paid', 'Due', 'Lead (d)']),
                  ...rep.data.slice(0, 150).map((r: any) => [
                    { text: r.supplierName, fontSize: 8 },
                    { text: String(r.poCount), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.totalAmount.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${r.paidAmount.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    {
                      text: `${cur}${r.dueAmount.toFixed(2)}`,
                      alignment: 'right' as const,
                      fontSize: 8,
                      color: r.dueAmount > 0 ? '#dc2626' : '#0f172a',
                    },
                    {
                      text: r.avgLeadTimeDays === null ? '—' : String(r.avgLeadTimeDays),
                      alignment: 'right' as const,
                      fontSize: 8,
                    },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'supplier-price-comparison': {
        const rep = await reportService.getSupplierPriceComparison();
        return {
          title: 'Supplier Price Comparison',
          content: [
            this.summaryRow('Products Compared', String(rep.summary.products)),
            this.summaryRow('Multi-supplier Products', String(rep.summary.multiSupplierProducts)),
            this.summaryRow('Average Price Spread', `${rep.summary.avgSpreadPercent}%`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product', 'SKU', 'Cheapest', 'Dearest', 'Spread']),
                  ...rep.data.slice(0, 150).map((r: any) => [
                    { text: r.productName, fontSize: 8 },
                    { text: r.sku || '', fontSize: 8 },
                    { text: `${cur}${r.cheapestPrice.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${r.dearestPrice.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${r.spreadPercent}%`, alignment: 'right' as const, fontSize: 8, color: '#16a34a' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'purchase-vs-sales': {
        const rep = await reportService.getPurchaseVsSalesTurnover(extra?.startDate, extra?.endDate);
        return {
          title: 'Purchase vs Sales Turnover',
          content: [
            this.summaryRow('Total Sales', `${cur}${rep.summary.totalSales.toFixed(2)}`),
            this.summaryRow('Total Purchases', `${cur}${rep.summary.totalPurchases.toFixed(2)}`),
            this.summaryRow('COGS', `${cur}${rep.summary.cogs.toFixed(2)}`),
            this.summaryRow('Closing Stock Value', `${cur}${rep.summary.stockValue.toFixed(2)}`),
            this.summaryRow('Stock Turnover Ratio', rep.summary.turnoverRatio === null ? '—' : String(rep.summary.turnoverRatio)),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Month', 'Sales', 'Purchases', 'Difference', 'Ratio']),
                  ...rep.data.map((r: any) => [
                    { text: r.month, fontSize: 8, bold: true },
                    { text: `${cur}${r.salesValue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.purchaseValue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    {
                      text: `${cur}${r.difference.toFixed(2)}`,
                      alignment: 'right' as const,
                      fontSize: 8,
                      color: r.difference >= 0 ? '#16a34a' : '#dc2626',
                    },
                    { text: r.ratio === null ? '—' : String(r.ratio), alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'auto-reorder': {
        const rep = await reportService.getAutoReorderSuggestion({});
        return {
          title: 'Auto Reorder Suggestions',
          content: [
            this.summaryRow('Items To Reorder', String(rep.summary.items)),
            this.summaryRow('Critical', String(rep.summary.critical)),
            this.summaryRow('Estimated Purchase Cost', `${cur}${rep.summary.totalEstimatedCost.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Product', 'Stock', 'Daily Sales', 'Days Left', 'Suggested', 'Est. Cost']),
                  ...rep.data.slice(0, 200).map((r: any) => [
                    { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                    { text: String(r.currentStock), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.avgDailySales), alignment: 'right' as const, fontSize: 8 },
                    { text: r.daysLeft === null ? '—' : String(r.daysLeft), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.suggestedQty), alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${r.estimatedCost.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'daily-register': {
        const rep = await reportService.getDailySalesRegister(extra?.startDate, extra?.endDate);
        return {
          title: 'Daily Sales Register',
          content: [
            this.summaryRow('Days', String(rep.summary.days)),
            this.summaryRow('Invoices', String(rep.summary.invoices)),
            this.summaryRow('Gross', `${cur}${rep.summary.gross.toFixed(2)}`),
            this.summaryRow('Discount', `${cur}${rep.summary.discount.toFixed(2)}`),
            this.summaryRow('Tax', `${cur}${rep.summary.tax.toFixed(2)}`),
            this.summaryRow('Net Sales', `${cur}${rep.summary.net.toFixed(2)}`),
            this.summaryRow('Credit Given', `${cur}${rep.summary.dues.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Date', 'Inv', 'Gross', 'Disc', 'Tax', 'Net', 'Due']),
                  ...rep.data.map((r: any) => [
                    { text: r.date, fontSize: 8, bold: true },
                    { text: String(r.invoices), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.gross.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.discount.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.tax.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.net.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${r.dues.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'wholesale-vs-retail': {
        const rep = await reportService.getWholesaleVsRetailReport(extra?.startDate, extra?.endDate);
        return {
          title: 'Wholesale vs Retail',
          content: [
            this.summaryRow('Total Revenue', `${cur}${rep.summary.totalRevenue.toFixed(2)}`),
            this.summaryRow('Total Invoices', String(rep.summary.totalInvoices)),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Channel', 'Invoices', 'Items', 'Revenue', 'Avg Bill', 'Share %']),
                  ...rep.data.map((r: any) => [
                    { text: r.channel, fontSize: 8, bold: true },
                    { text: String(r.invoices), alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.items), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.revenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${cur}${r.averageBill.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${r.revenueShare}%`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'top-products': {
        const rep = await reportService.getTopSellingProducts(extra?.startDate, extra?.endDate, 30);
        return {
          title: 'Top Selling Products',
          content: [
            this.summaryRow('Products', String(rep.summary.products)),
            this.summaryRow('Total Quantity', String(rep.summary.totalQuantity)),
            this.summaryRow('Total Revenue', `${cur}${rep.summary.totalRevenue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['#', 'Product', 'SKU', 'Qty', 'Revenue', 'Share %']),
                  ...rep.data.map((r: any) => [
                    { text: String(r.rank), fontSize: 8, bold: true },
                    { text: r.productName, fontSize: 8 },
                    { text: r.sku || '', fontSize: 8 },
                    { text: String(r.quantity), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.revenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${r.revenueShare}%`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      // ── Import / Export (LC) — Module 6 ────────────────────────────────────

      case 'lc-status': {
        const rep = await reportService.getLcStatusReport();
        return {
          title: 'Letter of Credit Status',
          content: [
            this.summaryRow('Total LCs', String(rep.summary.totalLcs)),
            this.summaryRow('Open LCs', String(rep.summary.openLcs)),
            this.summaryRow('Total Exposure', `${cur}${rep.summary.totalExposureBdt.toFixed(2)}`),
            this.summaryRow('Bank / LC Charges', `${cur}${rep.summary.totalChargesBdt.toFixed(2)}`),
            this.summaryRow('Expiring Soon', String(rep.summary.expiringSoon)),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['LC No', 'Status', 'Beneficiary', 'Currency', 'Amount', 'Amount BDT', 'Expiry']),
                  ...rep.data.map((r: any) => [
                    { text: r.lcNumber, fontSize: 8, bold: true },
                    { text: r.status, fontSize: 8 },
                    { text: r.beneficiary || '—', fontSize: 8 },
                    { text: r.currency, fontSize: 8 },
                    { text: String(r.lcAmount), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.lcAmountBdt.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—', fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'landed-cost': {
        const rep = await reportService.getLandedCostAnalysis(extra?.ciId);
        return {
          title: 'Landed Cost Analysis',
          content: [
            this.summaryRow('Cleared Invoices', String(rep.summary.invoices)),
            this.summaryRow('Total Landed Cost', `${cur}${rep.summary.totalLandedCost.toFixed(2)}`),
            this.summaryRow('Goods Value', `${cur}${rep.summary.totalGoodsCost.toFixed(2)}`),
            this.summaryRow('Freight & Insurance', `${cur}${rep.summary.totalFreight.toFixed(2)}`),
            this.summaryRow('Duty & VAT', `${cur}${rep.summary.totalDuty.toFixed(2)}`),
            this.summaryRow('Other + LC + C&F', `${cur}${rep.summary.totalOther.toFixed(2)}`),
            this.summaryRow('Average Margin', `${rep.summary.averageMarginPercent}%`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['CI No', 'Item', 'Qty', 'Goods', 'Freight', 'Duty', 'Landed/unit']),
                  ...rep.data.slice(0, 200).map((r: any) => [
                    { text: r.ciNumber, fontSize: 8 },
                    { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                    { text: String(r.quantity), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.goodsCostBdt.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.allocatedFreight.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.allocatedDuty.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    {
                      text: `${cur}${r.landedUnitCost.toFixed(2)}`,
                      alignment: 'right' as const,
                      fontSize: 8,
                      bold: true,
                    },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'agent-payables': {
        const rep = await reportService.getAgentPayables();
        return {
          title: 'C&F Agent Payables',
          content: [
            this.summaryRow('Agents', String(rep.summary.agents)),
            this.summaryRow('Agents With Dues', String(rep.summary.agentsWithDues)),
            this.summaryRow('Total Payable', `${cur}${rep.summary.totalPayable.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Agent', 'Type', 'Phone', 'Payable']),
                  ...rep.data.map((r: any) => [
                    { text: r.name, fontSize: 8, bold: true },
                    { text: r.agentType, fontSize: 8 },
                    { text: r.phone || '—', fontSize: 8 },
                    { text: `${cur}${r.payable.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      // ── Approvals & projects (Module 7) ────────────────────────────────────

      case 'pending-approvals': {
        const rep = await reportService.getPendingApprovalsReport();
        return {
          title: 'Pending Approvals',
          content: [
            this.summaryRow('Pending', String(rep.summary.pending)),
            this.summaryRow('Value Waiting', `${cur}${rep.summary.pendingValue.toFixed(2)}`),
            this.summaryRow('Approved', String(rep.summary.approved)),
            this.summaryRow('Rejected', String(rep.summary.rejected)),
            this.summaryRow('Avg Decision Time', `${rep.summary.averageDecisionDays} days`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Entity', 'Reference / Title', 'Amount', 'Level', 'Requested By', 'Waiting']),
                  ...rep.data.map((r: any) => [
                    { text: r.entityType.replace(/_/g, ' '), fontSize: 8 },
                    { text: `${r.entityRef}\n${r.title}`, fontSize: 8 },
                    { text: `${cur}${r.amount.toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true },
                    { text: `${r.currentLevel}/${r.totalLevels}`, alignment: 'center' as const, fontSize: 8 },
                    { text: r.requestedBy, fontSize: 8 },
                    {
                      text: `${r.waitingDays}d`,
                      alignment: 'right' as const,
                      fontSize: 8,
                      color: r.waitingDays > 5 ? '#dc2626' : '#64748b',
                    },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'project-pnl': {
        const rep = await reportService.getProjectProfitAndLoss(extra?.projectId);
        return {
          title: 'Project-wise P&L',
          content: [
            this.summaryRow('Projects', String(rep.summary.projects)),
            this.summaryRow('Revenue', `${cur}${rep.summary.revenue.toFixed(2)}`),
            this.summaryRow('Purchases', `${cur}${rep.summary.purchases.toFixed(2)}`),
            this.summaryRow('Expenses', `${cur}${rep.summary.expenses.toFixed(2)}`),
            this.summaryRow('Total Cost', `${cur}${rep.summary.cost.toFixed(2)}`),
            this.summaryRow('Profit', `${cur}${rep.summary.profit.toFixed(2)}`),
            this.summaryRow('Overall Margin', `${rep.summary.overallMarginPercent}%`),
            this.summaryRow('Loss-making Projects', String(rep.summary.lossMakingProjects)),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Code', 'Project', 'Budget', 'Revenue', 'Cost', 'Profit', 'Margin %']),
                  ...rep.data.map((r: any) => [
                    { text: r.code, fontSize: 8 },
                    { text: `${r.name}\n${r.status}`, fontSize: 8 },
                    { text: `${cur}${r.budget.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.revenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.totalCost.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    {
                      text: `${cur}${r.profit.toFixed(2)}`,
                      alignment: 'right' as const,
                      fontSize: 8,
                      bold: true,
                      color: r.profit >= 0 ? '#16a34a' : '#dc2626',
                    },
                    { text: `${r.marginPercent}%`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      // ── eCommerce, CRM & HR (Modules 8-10) ─────────────────────────────────

      case 'online-vs-offline': {
        const rep = await reportService.getOnlineVsOfflineSales(extra?.startDate, extra?.endDate);
        return {
          title: 'Online vs Offline Sales',
          content: [
            this.summaryRow('Counter Revenue', `${cur}${rep.summary.posRevenue.toFixed(2)}`),
            this.summaryRow('Online Revenue', `${cur}${rep.summary.onlineRevenue.toFixed(2)}`),
            this.summaryRow('Total Revenue', `${cur}${rep.summary.totalRevenue.toFixed(2)}`),
            this.summaryRow('Online Share', `${rep.summary.onlineSharePercent}%`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Month', 'POS Orders', 'POS Revenue', 'Online Orders', 'Online Revenue', 'Online %']),
                  ...rep.data.map((r: any) => [
                    { text: r.month, fontSize: 8, bold: true },
                    { text: String(r.posOrders), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.posRevenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: String(r.onlineOrders), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.onlineRevenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${r.onlineSharePercent}%`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'fulfillment-rate': {
        const rep = await reportService.getEcommerceFulfillmentRate(extra?.startDate, extra?.endDate);
        return {
          title: 'eCommerce Fulfilment Rate',
          content: [
            this.summaryRow('Orders', String(rep.summary.orders)),
            this.summaryRow('Delivered', String(rep.summary.delivered)),
            this.summaryRow('Fulfilment Rate', rep.summary.fulfillmentRatePercent === null ? '—' : `${rep.summary.fulfillmentRatePercent}%`),
            this.summaryRow('Cancellation Rate', `${rep.summary.cancellationRatePercent}%`),
            this.summaryRow('Average Delivery', rep.summary.averageDeliveryDays === null ? '—' : `${rep.summary.averageDeliveryDays} days`),
            this.summaryRow('COD Pending', `${cur}${rep.summary.codPending.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Order', 'Status', 'Courier', 'Courier Status', 'Amount', 'Days']),
                  ...rep.data.slice(0, 200).map((r: any) => [
                    { text: r.orderNo, fontSize: 8, bold: true },
                    { text: r.fulfillmentStatus, fontSize: 8 },
                    { text: r.courier, fontSize: 8 },
                    { text: r.courierStatus, fontSize: 8 },
                    { text: `${cur}${(r.totalAmount || 0).toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: r.daysToDeliver === null ? '—' : String(r.daysToDeliver), alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'lead-conversion': {
        const rep = await reportService.getLeadConversionReport(extra?.startDate, extra?.endDate);
        return {
          title: 'Lead Conversion Report',
          content: [
            this.summaryRow('Leads', String(rep.summary.totalLeads)),
            this.summaryRow('Open', String(rep.summary.open)),
            this.summaryRow('Won', String(rep.summary.won)),
            this.summaryRow('Conversion Rate', rep.summary.conversionRatePercent === null ? '—' : `${rep.summary.conversionRatePercent}%`),
            this.summaryRow('Open Pipeline Value', `${cur}${rep.summary.openPipelineValue.toFixed(2)}`),
            this.summaryRow('Won Value', `${cur}${rep.summary.wonValue.toFixed(2)}`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Stage', 'Leads', 'Value', 'Share %', '']),
                  ...rep.byStage.map((r: any) => [
                    { text: r.stage, fontSize: 8, bold: true },
                    { text: String(r.leads), alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${r.value.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${r.sharePercent}%`, alignment: 'right' as const, fontSize: 8 },
                    { text: '', fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
            { text: 'By source', fontSize: 10, bold: true, margin: [0, 14, 0, 6] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Source', 'Leads', 'Won', 'Conversion %', 'Won Value']),
                  ...rep.bySource.map((s: any) => [
                    { text: s.source.replace(/_/g, ' '), fontSize: 8 },
                    { text: String(s.leads), alignment: 'right' as const, fontSize: 8 },
                    { text: String(s.won), alignment: 'right' as const, fontSize: 8 },
                    { text: `${s.conversionRatePercent}%`, alignment: 'right' as const, fontSize: 8 },
                    { text: `${cur}${s.wonValue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'ticket-sla': {
        const rep = await reportService.getTicketSlaReport(extra?.startDate, extra?.endDate);
        return {
          title: 'Support Ticket SLA',
          content: [
            this.summaryRow('Tickets', String(rep.summary.tickets)),
            this.summaryRow('Open', String(rep.summary.open)),
            this.summaryRow('SLA Compliance', rep.summary.slaCompliancePercent === null ? '—' : `${rep.summary.slaCompliancePercent}%`),
            this.summaryRow('Currently Overdue', String(rep.summary.currentlyOverdue)),
            this.summaryRow('Avg First Response', rep.summary.averageResponseHours === null ? '—' : `${rep.summary.averageResponseHours}h`),
            this.summaryRow('Avg Resolution', rep.summary.averageResolutionHours === null ? '—' : `${rep.summary.averageResolutionHours}h`),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  this.headerRow(['Ticket', 'Subject', 'Priority', 'Status', 'Response', 'Resolved', 'SLA']),
                  ...rep.data.slice(0, 200).map((t: any) => [
                    { text: t.ticketNo, fontSize: 8, bold: true },
                    { text: t.subject, fontSize: 8 },
                    { text: t.priority, fontSize: 8 },
                    { text: t.status, fontSize: 8 },
                    { text: t.responseHours === null ? '—' : `${t.responseHours}h`, alignment: 'right' as const, fontSize: 8 },
                    { text: t.resolutionHours === null ? '—' : `${t.resolutionHours}h`, alignment: 'right' as const, fontSize: 8 },
                    {
                      text: t.slaMet === null ? (t.isBreached ? 'BREACHED' : 'waiting') : t.slaMet ? 'met' : 'breached',
                      fontSize: 8,
                      color: t.slaMet === false || t.isBreached ? '#dc2626' : '#16a34a',
                    },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        };
      }

      case 'leave-summary': {
        const rep = await reportService.getLeaveSummary(extra?.startDate, extra?.endDate);
        return {
          title: 'Leave Summary',
          content: [
            this.summaryRow('Approved Requests', String(rep.summary.requests)),
            this.summaryRow('Employees', String(rep.summary.employees)),
            this.summaryRow('Total Leave Days', String(rep.summary.totalDays)),
            this.summaryRow('Average Days / Employee', String(rep.summary.averageDaysPerEmployee)),
            { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', '*'],
                body: [
                  this.headerRow(['Employee', 'Code', 'Department', 'Days', 'Breakdown']),
                  ...rep.data.map((r: any) => [
                    { text: r.employeeName, fontSize: 8, bold: true },
                    { text: r.employeeCode || '—', fontSize: 8 },
                    { text: r.department || '—', fontSize: 8 },
                    { text: String(r.days), alignment: 'right' as const, fontSize: 8 },
                    { text: Object.entries(r.byType).map(([k, v]) => `${k}: ${v}`).join(', '), fontSize: 7 },
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

  /** Summary + table shared by the category / brand / group wise reports. */
  private dimensionPdfContent(label: string, rep: any, cur: string): Content[] {
    const top = rep.summary.topCategory ?? rep.summary.topBrand ?? rep.summary.topGroup ?? '—';
    return [
      this.summaryRow('Total Revenue', `${cur}${(rep.summary.totalRevenue || 0).toFixed(2)}`),
      this.summaryRow('Total Gross Profit', `${cur}${(rep.summary.totalProfit || 0).toFixed(2)}`),
      this.summaryRow(`Top ${label}`, String(top)),
      { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            this.headerRow([label, 'Qty', 'Revenue', 'Cost', 'Gross Profit', 'Margin %']),
            ...rep.data.map((r: any) => [
              { text: r.name, fontSize: 8, bold: true },
              { text: String(r.totalQty), alignment: 'center' as const, fontSize: 8 },
              { text: `${cur}${r.totalRevenue.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
              { text: `${cur}${r.totalCost.toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
              {
                text: `${cur}${r.grossProfit.toFixed(2)}`,
                alignment: 'right' as const,
                fontSize: 8,
                bold: true,
                color: r.grossProfit >= 0 ? '#16a34a' : '#dc2626',
              },
              { text: `${r.profitMarginPercent}%`, alignment: 'right' as const, fontSize: 8 },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ];
  }

  /** Summary + table shared by the inventory by-category/brand/group reports. */
  private inventoryPdfContent(label: string, rep: any, cur: string): Content[] {
    const isSummary = rep.data.length === 0 ? true : 'productCount' in rep.data[0];
    const head: Content[] = [
      this.summaryRow('Total Asset Value', `${cur}${(rep.summary.totalAssetValue || 0).toFixed(2)}`),
      this.summaryRow('Total Qty On Hand', String(rep.summary.totalQty || 0)),
      this.summaryRow(
        isSummary ? `${label} groups` : 'Items in this ' + label.toLowerCase(),
        String(isSummary ? rep.summary.totalGroups ?? rep.data.length : rep.summary.totalItems ?? rep.data.length)
      ),
      { text: '', margin: [0, 10, 0, 0] as [number, number, number, number] },
    ];

    const table: Content = isSummary
      ? {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              this.headerRow([label, 'Products', 'Variants', 'Qty', 'Asset Value']),
              ...rep.data.map((r: any) => [
                { text: r.name, fontSize: 8, bold: true },
                { text: String(r.productCount ?? 0), alignment: 'right' as const, fontSize: 8 },
                { text: String(r.variantCount ?? 0), alignment: 'right' as const, fontSize: 8 },
                { text: String(r.totalQty ?? 0), alignment: 'right' as const, fontSize: 8 },
                { text: `${cur}${(r.totalAssetValue || 0).toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: '#16a34a' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        }
      : {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              this.headerRow(['Product', 'SKU', 'Stock', 'Cost', 'Asset Value']),
              ...rep.data.map((r: any) => [
                { text: `${r.productName}\n${r.variantName || ''}`, fontSize: 8 },
                { text: r.sku, fontSize: 8 },
                { text: `${r.currentStock} ${r.unit || ''}`, alignment: 'right' as const, fontSize: 8 },
                { text: `${cur}${(r.costPrice || 0).toFixed(2)}`, alignment: 'right' as const, fontSize: 8 },
                { text: `${cur}${(r.assetValue || 0).toFixed(2)}`, alignment: 'right' as const, fontSize: 8, bold: true, color: '#16a34a' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        };

    return [...head, table];
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

  /**
   * Renders an already-built document. Public so the wholesale invoice and the
   * price-list catalogue (built in the sale/product services) reuse this one
   * pdfmake setup instead of standing up their own.
   */
  renderPdfToBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      /**
       * pdfmake rejects some problems (an image it cannot load, for instance) on
       * an internal promise that never reaches the callback below. Unhandled,
       * that rejection takes the whole server process down — so it is caught
       * here and turned into a normal error the request can survive.
       */
      const rescue = (reason: unknown) => {
        process.removeListener('unhandledRejection', rescue);
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      };
      process.on('unhandledRejection', rescue);

      const settle = (done: () => void) => {
        process.removeListener('unhandledRejection', rescue);
        done();
      };

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
          settle(() => resolve(Buffer.from(buffer)));
        });
      } catch (err) {
        settle(() => reject(err));
      }
    });
  }

  // ───────────────────────────── EXCEL GENERATION ─────────────────────────────

  async generateExcel(
    type: string,
    startDate?: string,
    endDate?: string,
    extra?: Record<string, string>
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

      case 'purchases': {
        const rep = await reportService.getPurchaseReport(startDate, endDate);
        ws.name = 'Purchases Summary';

        this.addExcelHeaders(ws, ['PO #', 'Date', 'Supplier', 'Status', 'Total', 'Paid', 'Due']);

        for (const po of rep.data as any[]) {
          ws.addRow([
            po.poNumber,
            new Date(po.createdAt).toLocaleDateString('en-GB'),
            po.supplierId?.companyName || '—',
            po.status,
            po.totalAmount,
            po.paidAmount,
            po.dueAmount,
          ]);
        }

        ws.addRow([]);
        const sumRow = ws.addRow([
          'TOTALS',
          '',
          '',
          '',
          rep.summary.totalOrderedValue,
          rep.summary.totalPaid,
          rep.summary.totalDue,
        ]);
        sumRow.font = { bold: true };

        this.formatCurrencyColumns(ws, [5, 6, 7], cur);
        break;
      }

      case 'wastage': {
        const rep = await reportService.getInventoryWastageReport(startDate, endDate);
        ws.name = 'Wastage & Shrinkage';

        this.addExcelHeaders(ws, [
          'Product',
          'Qty',
          'Unit',
          'Unit Cost',
          'Loss Value',
          'Reason',
          'Recorded By',
          'Date',
        ]);

        for (const m of rep.data) {
          ws.addRow([
            m.productName,
            m.quantity,
            m.unit,
            m.unitCost,
            m.lossValue,
            m.reason || '—',
            m.recordedBy || '—',
            new Date(m.createdAt).toLocaleDateString('en-GB'),
          ]);
        }

        ws.addRow([]);
        const sumRow = ws.addRow(['TOTALS', rep.summary.totalQty, '', '', rep.summary.totalLossValue]);
        sumRow.font = { bold: true };

        this.formatCurrencyColumns(ws, [4, 5], cur);
        break;
      }

      case 'category-wise-sales': {
        const rep = await reportService.getCategoryWiseSalesReport(startDate, endDate);
        ws.name = 'Category-wise Sales';
        this.addDimensionExcelRows(ws, 'Category', rep, cur);
        break;
      }

      case 'brand-wise-sales': {
        const rep = await reportService.getBrandWiseSalesReport(startDate, endDate);
        ws.name = 'Brand-wise Sales';
        this.addDimensionExcelRows(ws, 'Brand', rep, cur);
        break;
      }

      case 'group-wise-sales': {
        const rep = await reportService.getGroupWiseSalesReport(startDate, endDate);
        ws.name = 'Group-wise Sales';
        this.addDimensionExcelRows(ws, 'Product Group', rep, cur);
        break;
      }

      case 'product-analysis': {
        const rep = await reportService.getProductAnalysis({
          startDate,
          endDate,
          groupBy: extra?.groupBy,
          categoryId: extra?.categoryId,
          subCategoryId: extra?.subCategoryId,
          brandId: extra?.brandId,
          groupId: extra?.groupId,
          color: extra?.color,
          modelNo: extra?.modelNo,
          tag: extra?.tag,
          barcode: extra?.barcode,
        });
        const labels: Record<string, string> = {
          product: 'Product',
          variant: 'Variant',
          barcode: 'Barcode',
          category: 'Category',
          brand: 'Brand',
          group: 'Product Group',
        };
        const label = labels[rep.groupBy] || 'Product';
        ws.name = 'Product Analysis';
        this.addDimensionExcelRows(ws, label, rep, cur);
        break;
      }

      case 'barcode-wise': {
        const rep = await reportService.getBarcodeWiseReport(extra?.barcode, startDate, endDate);
        ws.name = 'Barcode Trace';
        this.addExcelHeaders(ws, ['Date', 'Type', 'Qty In', 'Qty Out', 'Reference', 'Balance After']);
        for (const m of rep.movements) {
          ws.addRow([
            new Date(m.date).toLocaleDateString('en-GB'),
            m.type,
            m.qtyIn || null,
            m.qtyOut || null,
            m.reference || '—',
            m.balanceAfter,
          ]);
        }
        ws.addRow([]);
        const infoRow = ws.addRow([
          `${rep.product.name} (${rep.product.sku}) | Opening ${rep.summary.openingStock} → Closing ${rep.summary.closingStock} | Purchased ${rep.summary.totalPurchased} · Sold ${rep.summary.totalSold} · Adjusted ${rep.summary.totalAdjusted}`,
        ]);
        infoRow.font = { bold: true, italic: true };
        break;
      }

      case 'low-stock': {
        const rep = await reportService.getLowStockReport(extra?.threshold ? Number(extra.threshold) : undefined);
        ws.name = 'Low Stock';
        this.addExcelHeaders(ws, ['Product', 'Variant', 'SKU', 'Category', 'Brand', 'Stock', 'Alert Qty', 'Unit', 'Stock Value', 'Supplier']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.productName,
            r.variantName || '',
            r.sku,
            r.category,
            r.brand,
            r.currentStock,
            r.alertQty,
            r.unit,
            r.stockValue,
            r.lastSupplier || '—',
          ]);
        }
        ws.addRow([]);
        const lowSum = ws.addRow(['TOTALS', '', '', '', '', '', '', '', rep.summary.totalStockValue, `${rep.summary.totalItems} items · ${rep.summary.outOfStock} out of stock`]);
        lowSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [9], cur);
        break;
      }

      case 'dead-stock': {
        const rep = await reportService.getDeadStockReport(extra?.days ? Number(extra.days) : 90);
        ws.name = 'Dead Stock';
        this.addExcelHeaders(ws, ['Product', 'Variant', 'SKU', 'Category', 'Brand', 'Stock', 'Cost Price', 'Dead Value', 'Days Since Sale', 'Sold Ever']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.productName,
            r.variantName || '',
            r.sku,
            r.category,
            r.brand,
            r.currentStock,
            r.costPrice,
            r.deadValue,
            r.daysSinceLastSale === null ? 'Never' : r.daysSinceLastSale,
            r.totalSoldEver,
          ]);
        }
        ws.addRow([]);
        const deadSum = ws.addRow(['TOTALS', '', '', '', '', rep.summary.totalQty, '', rep.summary.totalDeadValue, '', '']);
        deadSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [7, 8], cur);
        break;
      }

      case 'inventory-by-category': {
        const rep = await reportService.getInventoryByCategory(extra?.categoryId);
        ws.name = 'Inventory by Category';
        this.addInventoryExcelRows(ws, 'Category', rep, cur);
        break;
      }

      case 'inventory-by-brand': {
        const rep = await reportService.getInventoryByBrand(extra?.brandId);
        ws.name = 'Inventory by Brand';
        this.addInventoryExcelRows(ws, 'Brand', rep, cur);
        break;
      }

      case 'inventory-by-group': {
        const rep = await reportService.getInventorySummaryByGroup();
        ws.name = 'Inventory by Group';
        this.addInventoryExcelRows(ws, 'Product Group', rep, cur);
        break;
      }

      case 'inventory-aging': {
        const rep = await reportService.getInventoryAging();
        ws.name = 'Inventory Aging';
        this.addExcelHeaders(ws, ['Age Bucket', 'Items', 'Qty', 'Asset Value']);
        for (const b of rep.data) {
          ws.addRow([`${b.bucket} days`, b.items, b.totalQty, b.totalAssetValue]);
        }
        ws.addRow([]);
        const agingSum = ws.addRow(['TOTAL', rep.summary.totalItems, rep.summary.totalQty, rep.summary.totalAssetValue]);
        agingSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [4], cur);
        break;
      }

      case 'stock-reorder': {
        const rep = await reportService.getStockReorderReport();
        ws.name = 'Stock Reorder';
        this.addExcelHeaders(ws, ['Product', 'Variant', 'Stock', 'Avg Daily Sales', 'Avg Monthly Sales', 'Days Left', 'Suggested Qty', 'Supplier', 'Last Price', 'Est Cost']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.productName,
            r.variantName || '',
            r.currentStock,
            r.avgDailySales,
            r.avgMonthlySales,
            r.daysLeft === null ? '' : r.daysLeft,
            r.suggestedQty,
            r.supplier || '—',
            r.lastPurchasePrice,
            r.estimatedCost,
          ]);
        }
        ws.addRow([]);
        const reorderSum = ws.addRow(['TOTALS', '', '', '', '', '', '', '', '', rep.summary.totalEstimatedCost]);
        reorderSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [9, 10], cur);
        break;
      }

      // ── Inventory Suite (Phase 8) ──────────────────────────────────────────

      case 'stock-ledger': {
        const rep = await reportService.getStockLedger({
          productId: extra?.productId,
          variantId: extra?.variantId,
          startDate: extra?.startDate,
          endDate: extra?.endDate,
        });
        ws.name = 'Stock Ledger';
        this.addExcelHeaders(ws, ['Date', 'Item', 'Type', 'Source', 'Qty', 'Balance', 'Unit Cost', 'Value', 'Reason', 'By']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            new Date(r.date).toLocaleDateString(),
            r.productName,
            r.type,
            r.referenceType,
            r.quantity,
            r.balance,
            r.unitCost,
            r.value,
            r.reason || '',
            r.user || '',
          ]);
        }
        ws.addRow([]);
        const ledgerSum = ws.addRow([
          'TOTALS',
          '',
          '',
          '',
          rep.summary.totalIn - rep.summary.totalOut,
          rep.summary.closingBalance,
          '',
          '',
          '',
          '',
        ]);
        ledgerSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [7, 8], cur);
        break;
      }

      case 'stock-movement-summary': {
        const rep = await reportService.getStockMovementSummary(extra?.startDate, extra?.endDate);
        ws.name = 'Movement Summary';
        this.addExcelHeaders(ws, ['Type', 'Source', 'Events', 'Quantity', 'Value']);
        for (const r of rep.byType as any[]) {
          ws.addRow([r.type, r.referenceType, r.events, r.quantity, r.value]);
        }
        ws.addRow([]);
        ws.addRow(['TOP MOVERS']).font = { bold: true };
        this.addExcelHeaders(ws, ['Product', 'In', 'Out', 'Net']);
        for (const r of rep.topMovers as any[]) {
          ws.addRow([r.productName || '—', r.inQty, r.outQty, r.netQty]);
        }
        this.formatCurrencyColumns(ws, [5], cur);
        break;
      }

      case 'expiry': {
        const rep = await reportService.getExpiryReport(extra?.days ? parseInt(extra.days) : 30);
        ws.name = 'Expiry';
        this.addExcelHeaders(ws, ['Product', 'Variant', 'SKU', 'Batch', 'Expiry', 'Days Left', 'Status', 'Qty', 'Value']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.productName,
            r.variantName || '',
            r.sku || '',
            r.batchNo || '',
            new Date(r.expiryDate).toLocaleDateString(),
            r.daysLeft,
            r.status,
            r.quantity,
            r.value,
          ]);
        }
        ws.addRow([]);
        const expirySum = ws.addRow(['TOTALS', '', '', '', '', '', '', '', rep.summary.expiredValue + rep.summary.atRiskValue]);
        expirySum.font = { bold: true };
        this.formatCurrencyColumns(ws, [9], cur);
        break;
      }

      case 'supplier-wise-purchases': {
        const rep = await reportService.getSupplierWisePurchaseReport(startDate, endDate);
        ws.name = 'Supplier Purchases';
        this.addExcelHeaders(ws, [
          'Supplier', 'Phone', 'POs', 'Open', 'Ordered Qty', 'Received Qty',
          'Purchased', 'Paid', 'Due', 'Outstanding', 'Lead Days', 'Share %',
        ]);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.supplierName,
            r.phone || '',
            r.poCount,
            r.openOrders,
            r.orderedQty,
            r.receivedQty,
            r.totalAmount,
            r.paidAmount,
            r.dueAmount,
            r.outstanding,
            r.avgLeadTimeDays === null ? '' : r.avgLeadTimeDays,
            r.revenueShare,
          ]);
        }
        this.formatCurrencyColumns(ws, [7, 8, 9, 10], cur);
        break;
      }

      case 'supplier-price-comparison': {
        const rep = await reportService.getSupplierPriceComparison();
        ws.name = 'Supplier Prices';
        this.addExcelHeaders(ws, ['Product', 'SKU', 'Supplier', 'Last Price', 'Min', 'Max', 'Qty Bought', 'Orders', 'Cheapest']);
        for (const p of rep.data as any[]) {
          for (const s of p.suppliers) {
            ws.addRow([
              p.productName,
              p.sku || '',
              s.supplierName || '—',
              s.lastPrice,
              s.minPrice,
              s.maxPrice,
              s.totalQty,
              s.orders,
              s.isCheapest ? 'YES' : '',
            ]);
          }
        }
        this.formatCurrencyColumns(ws, [4, 5, 6], cur);
        break;
      }

      case 'purchase-vs-sales': {
        const rep = await reportService.getPurchaseVsSalesTurnover(extra?.startDate, extra?.endDate);
        ws.name = 'Purchase vs Sales';
        this.addExcelHeaders(ws, ['Month', 'Sales', 'Purchases', 'Difference', 'Ratio', 'Invoices', 'Orders']);
        for (const r of rep.data as any[]) {
          ws.addRow([r.month, r.salesValue, r.purchaseValue, r.difference, r.ratio ?? '', r.invoices, r.orders]);
        }
        ws.addRow([]);
        const pvsSum = ws.addRow([
          'TOTALS',
          rep.summary.totalSales,
          rep.summary.totalPurchases,
          rep.summary.totalSales - rep.summary.totalPurchases,
          rep.summary.turnoverRatio ?? '',
          '',
          '',
        ]);
        pvsSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [2, 3, 4], cur);
        break;
      }

      case 'auto-reorder': {
        const rep = await reportService.getAutoReorderSuggestion({});
        ws.name = 'Auto Reorder';
        this.addExcelHeaders(ws, ['Product', 'Variant', 'SKU', 'Stock', 'Daily Sales', 'Days Left', 'Target', 'Suggested Qty', 'Supplier', 'Est Cost', 'Priority']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.productName,
            r.variantName || '',
            r.sku || '',
            r.currentStock,
            r.avgDailySales,
            r.daysLeft === null ? '' : r.daysLeft,
            r.targetStock,
            r.suggestedQty,
            r.supplierName || '—',
            r.estimatedCost,
            r.priority,
          ]);
        }
        ws.addRow([]);
        const autoSum = ws.addRow(['TOTALS', '', '', '', '', '', '', '', '', rep.summary.totalEstimatedCost, '']);
        autoSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [10], cur);
        break;
      }

      case 'daily-register': {
        const rep = await reportService.getDailySalesRegister(extra?.startDate, extra?.endDate);
        ws.name = 'Daily Register';
        this.addExcelHeaders(ws, ['Date', 'Invoices', 'Items', 'Gross', 'Discount', 'Tax', 'Net', 'Cash', 'Card', 'MFS', 'Other', 'Due', 'Avg Bill']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.date,
            r.invoices,
            r.items,
            r.gross,
            r.discount,
            r.tax,
            r.net,
            r.cash,
            r.card,
            r.mfs,
            r.other,
            r.dues,
            r.averageBill,
          ]);
        }
        ws.addRow([]);
        const regSum = ws.addRow([
          'TOTALS',
          rep.summary.invoices,
          '',
          rep.summary.gross,
          rep.summary.discount,
          rep.summary.tax,
          rep.summary.net,
          '',
          '',
          '',
          '',
          rep.summary.dues,
          '',
        ]);
        regSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], cur);
        break;
      }

      case 'wholesale-vs-retail': {
        const rep = await reportService.getWholesaleVsRetailReport(extra?.startDate, extra?.endDate);
        ws.name = 'Wholesale vs Retail';
        this.addExcelHeaders(ws, ['Channel', 'Invoices', 'Items', 'Revenue', 'Discount', 'Due', 'Avg Bill', 'Avg Items', 'Revenue Share %']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.channel,
            r.invoices,
            r.items,
            r.revenue,
            r.discount,
            r.dues,
            r.averageBill,
            r.averageItems,
            r.revenueShare,
          ]);
        }
        this.formatCurrencyColumns(ws, [4, 5, 6, 7], cur);
        break;
      }

      case 'top-products': {
        const rep = await reportService.getTopSellingProducts(extra?.startDate, extra?.endDate, 50);
        ws.name = 'Top Products';
        this.addExcelHeaders(ws, ['Rank', 'Product', 'SKU', 'Unit', 'Quantity', 'Revenue', 'Orders', 'Share %']);
        for (const r of rep.data as any[]) {
          ws.addRow([r.rank, r.productName, r.sku || '', r.unit || '', r.quantity, r.revenue, r.orders, r.revenueShare]);
        }
        ws.addRow([]);
        const topSum = ws.addRow(['', 'TOTALS', '', '', rep.summary.totalQuantity, rep.summary.totalRevenue, '', '']);
        topSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [6], cur);
        break;
      }

      // ── Import / Export (LC) — Module 6 ────────────────────────────────────

      case 'lc-status': {
        const rep = await reportService.getLcStatusReport();
        ws.name = 'LC Status';
        this.addExcelHeaders(ws, ['LC No', 'Type', 'Status', 'Beneficiary', 'Bank', 'Currency', 'Amount', 'Amount BDT', 'Charges BDT', 'Outstanding BDT', 'Issue', 'Latest Shipment', 'Expiry', 'Alert']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.lcNumber,
            r.lcType,
            r.status,
            r.beneficiary,
            r.issuingBank,
            r.currency,
            r.lcAmount,
            r.lcAmountBdt,
            r.totalChargesBdt,
            r.outstandingBdt,
            new Date(r.issueDate).toLocaleDateString(),
            r.latestShipmentDate ? new Date(r.latestShipmentDate).toLocaleDateString() : '',
            r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '',
            r.alert || '',
          ]);
        }
        ws.addRow([]);
        const lcSum = ws.addRow(['TOTALS', '', '', '', '', '', '', '', rep.summary.totalChargesBdt, rep.summary.totalExposureBdt, '', '', '', '']);
        lcSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [8, 9, 10], cur);
        break;
      }

      case 'landed-cost': {
        const rep = await reportService.getLandedCostAnalysis(extra?.ciId);
        ws.name = 'Landed Cost';
        this.addExcelHeaders(ws, ['CI No', 'Supplier', 'Product', 'Variant', 'SKU', 'Qty', 'Goods Cost', 'Freight', 'Duty/VAT', 'Other', 'Landed/Unit', 'Landed Total', 'Current Cost', 'Selling Price', 'Margin', 'Margin %']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.ciNumber,
            r.supplierName,
            r.productName,
            r.variantName || '',
            r.sku || '',
            r.quantity,
            r.goodsCostBdt,
            r.allocatedFreight,
            r.allocatedDuty,
            r.allocatedOther,
            r.landedUnitCost,
            r.landedTotal,
            r.currentCostPrice ?? '',
            r.sellingPrice,
            r.marginPerUnit,
            r.marginPercent ?? '',
          ]);
        }
        ws.addRow([]);
        const lcCostSum = ws.addRow(['TOTALS', '', '', '', '', '', '', '', '', '', '', rep.summary.totalLandedCost, '', '', '', '']);
        lcCostSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [7, 8, 9, 10, 11, 12, 13, 14, 15], cur);
        break;
      }

      case 'agent-payables': {
        const rep = await reportService.getAgentPayables();
        ws.name = 'Agent Payables';
        this.addExcelHeaders(ws, ['Agent', 'Type', 'Phone', 'Payable', 'Active']);
        for (const r of rep.data as any[]) {
          ws.addRow([r.name, r.agentType, r.phone || '', r.payable, r.isActive ? 'YES' : 'NO']);
        }
        ws.addRow([]);
        const apSum = ws.addRow(['TOTALS', '', '', rep.summary.totalPayable, '']);
        apSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [4], cur);
        break;
      }

      // ── Approvals & projects (Module 7) ────────────────────────────────────

      case 'pending-approvals': {
        const rep = await reportService.getPendingApprovalsReport();
        ws.name = 'Pending Approvals';
        this.addExcelHeaders(ws, ['Entity', 'Reference', 'Title', 'Amount', 'Workflow', 'Level', 'Total Levels', 'Requested By', 'Requested At', 'Waiting Days']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.entityType,
            r.entityRef,
            r.title,
            r.amount,
            r.workflowName,
            r.currentLevel,
            r.totalLevels,
            r.requestedBy,
            new Date(r.requestedAt).toLocaleString(),
            r.waitingDays,
          ]);
        }
        ws.addRow([]);
        const paSum = ws.addRow(['TOTALS', '', '', rep.summary.pendingValue, '', '', '', '', '', '']);
        paSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [4], cur);
        break;
      }

      case 'project-pnl': {
        const rep = await reportService.getProjectProfitAndLoss(extra?.projectId);
        ws.name = 'Project P&L';
        this.addExcelHeaders(ws, ['Code', 'Project', 'Status', 'Customer', 'Manager', 'Budget', 'Revenue', 'Purchases', 'Expenses', 'Total Cost', 'Profit', 'Margin %', 'Budget Used %', 'Due']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.code,
            r.name,
            r.status,
            r.customerName,
            r.managerName,
            r.budget,
            r.revenue,
            r.purchases,
            r.expenses,
            r.totalCost,
            r.profit,
            r.marginPercent,
            r.budgetUsedPercent ?? '',
            r.due,
          ]);
        }
        ws.addRow([]);
        const ppSum = ws.addRow([
          'TOTALS', '', '', '', '', rep.summary.budget, rep.summary.revenue, rep.summary.purchases,
          rep.summary.expenses, rep.summary.cost, rep.summary.profit, rep.summary.overallMarginPercent, '', rep.summary.due,
        ]);
        ppSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [6, 7, 8, 9, 10, 11], cur);
        break;
      }

      // ── eCommerce, CRM & HR (Modules 8-10) ─────────────────────────────────

      case 'online-vs-offline': {
        const rep = await reportService.getOnlineVsOfflineSales(extra?.startDate, extra?.endDate);
        ws.name = 'Online vs Offline';
        this.addExcelHeaders(ws, ['Month', 'POS Orders', 'POS Revenue', 'POS Avg Order', 'Online Orders', 'Online Revenue', 'Online Avg Order', 'Total Revenue', 'Online Share %']);
        for (const r of rep.data as any[]) {
          ws.addRow([r.month, r.posOrders, r.posRevenue, r.posAverageOrder, r.onlineOrders, r.onlineRevenue, r.onlineAverageOrder, r.totalRevenue, r.onlineSharePercent]);
        }
        this.formatCurrencyColumns(ws, [3, 4, 6, 7, 8], cur);
        break;
      }

      case 'fulfillment-rate': {
        const rep = await reportService.getEcommerceFulfillmentRate(extra?.startDate, extra?.endDate);
        ws.name = 'Fulfilment Rate';
        this.addExcelHeaders(ws, ['Order', 'Date', 'Amount', 'Payment', 'Fulfilment', 'Courier', 'Courier Status', 'Tracking', 'Days To Deliver']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.orderNo,
            new Date(r.createdAt).toLocaleDateString(),
            r.totalAmount,
            r.paymentStatus,
            r.fulfillmentStatus,
            r.courier,
            r.courierStatus,
            r.trackingCode,
            r.daysToDeliver ?? '',
          ]);
        }
        ws.addRow([]);
        const frSum = ws.addRow([`Fulfilment rate: ${rep.summary.fulfillmentRatePercent ?? '—'}%`, '', rep.summary.onlineRevenue, '', `Avg delivery: ${rep.summary.averageDeliveryDays ?? '—'} days`]);
        frSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [3], cur);
        break;
      }

      case 'lead-conversion': {
        const rep = await reportService.getLeadConversionReport(extra?.startDate, extra?.endDate);
        ws.name = 'Lead Conversion';
        this.addExcelHeaders(ws, ['Lead No', 'Name', 'Phone', 'Company', 'Source', 'Stage', 'Value', 'Probability %', 'Assigned To', 'Created', 'Converted', 'Days In Pipeline', 'Lost Reason']);
        for (const r of rep.data as any[]) {
          ws.addRow([
            r.leadNo, r.name, r.phone, r.company || '', r.source, r.stage, r.estimatedValue, r.probability,
            r.assignedTo, new Date(r.createdAt).toLocaleDateString(),
            r.convertedAt ? new Date(r.convertedAt).toLocaleDateString() : '', r.daysInPipeline, r.lostReason || '',
          ]);
        }
        ws.addRow([]);
        const lcSum = ws.addRow([`Conversion rate: ${rep.summary.conversionRatePercent ?? '—'}%`, '', '', '', '', `Won: ${rep.summary.won} / Lost: ${rep.summary.lost}`, rep.summary.wonValue, '', '', '', '', '', '']);
        lcSum.font = { bold: true };
        this.formatCurrencyColumns(ws, [7], cur);
        break;
      }

      case 'ticket-sla': {
        const rep = await reportService.getTicketSlaReport(extra?.startDate, extra?.endDate);
        ws.name = 'Ticket SLA';
        this.addExcelHeaders(ws, ['Ticket', 'Subject', 'Customer', 'Priority', 'Status', 'Assignee', 'Created', 'SLA Due', 'First Response', 'Resolved', 'Response Hours', 'Resolution Hours', 'SLA Met']);
        for (const t of rep.data as any[]) {
          ws.addRow([
            t.ticketNo, t.subject, t.customer, t.priority, t.status, t.assignee,
            new Date(t.createdAt).toLocaleString(), new Date(t.slaDueAt).toLocaleString(),
            t.firstResponseAt ? new Date(t.firstResponseAt).toLocaleString() : '',
            t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : '',
            t.responseHours ?? '', t.resolutionHours ?? '',
            t.slaMet === null ? (t.isBreached ? 'BREACHED' : 'waiting') : t.slaMet ? 'met' : 'breached',
          ]);
        }
        ws.addRow([]);
        const tsSum = ws.addRow([`SLA compliance: ${rep.summary.slaCompliancePercent ?? '—'}%`, '', '', '', `Overdue: ${rep.summary.currentlyOverdue}`, '', '', '', '', '', rep.summary.averageResponseHours ?? '', rep.summary.averageResolutionHours ?? '', '']);
        tsSum.font = { bold: true };
        break;
      }

      case 'leave-summary': {
        const rep = await reportService.getLeaveSummary(extra?.startDate, extra?.endDate);
        ws.name = 'Leave Summary';
        this.addExcelHeaders(ws, ['Employee', 'Code', 'Department', 'Leave Days', 'Requests', 'Breakdown']);
        for (const r of rep.data as any[]) {
          ws.addRow([r.employeeName, r.employeeCode || '', r.department || '', r.days, r.requests, Object.entries(r.byType).map(([k, v]) => `${k}: ${v}`).join(', ')]);
        }
        ws.addRow([]);
        const lvSum = ws.addRow(['TOTAL', '', '', rep.summary.totalDays, rep.summary.requests, `Average ${rep.summary.averageDaysPerEmployee} day(s) per employee`]);
        lvSum.font = { bold: true };
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

  /** Rows + totals shared by the category / brand / group wise Excel sheets. */
  private addDimensionExcelRows(ws: ExcelJS.Worksheet, label: string, rep: any, cur: string): void {
    this.addExcelHeaders(ws, [label, 'Qty', 'Revenue', 'Cost', 'Gross Profit', 'Margin %']);

    for (const r of rep.data) {
      ws.addRow([r.name, r.totalQty, r.totalRevenue, r.totalCost, r.grossProfit, r.profitMarginPercent]);
    }

    ws.addRow([]);
    const sumRow = ws.addRow([
      'TOTALS',
      '',
      rep.summary.totalRevenue,
      '',
      rep.summary.totalProfit,
      '',
    ]);
    sumRow.font = { bold: true };
    sumRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });

    this.formatCurrencyColumns(ws, [3, 4, 5], cur);
  }

  /** Rows + totals shared by the inventory by-category/brand/group Excel sheets. */
  private addInventoryExcelRows(ws: ExcelJS.Worksheet, label: string, rep: any, cur: string): void {
    const isSummary = rep.data.length === 0 ? true : 'productCount' in rep.data[0];

    if (isSummary) {
      this.addExcelHeaders(ws, [label, 'Products', 'Variants', 'Qty', 'Asset Value', 'Retail Value']);
      for (const r of rep.data) {
        ws.addRow([r.name, r.productCount ?? 0, r.variantCount ?? 0, r.totalQty ?? 0, r.totalAssetValue ?? 0, r.retailValue ?? 0]);
      }
      ws.addRow([]);
      const sum = ws.addRow(['TOTALS', '', '', rep.summary.totalQty, rep.summary.totalAssetValue, '']);
      sum.font = { bold: true };
      this.formatCurrencyColumns(ws, [5, 6], cur);
    } else {
      this.addExcelHeaders(ws, ['Product', 'Variant', 'SKU', 'Unit', 'Stock', 'Cost', 'Retail', 'Asset Value', 'Status']);
      for (const r of rep.data) {
        ws.addRow([
          r.productName,
          r.variantName || '',
          r.sku,
          r.unit,
          r.currentStock,
          r.costPrice,
          r.retailPrice,
          r.assetValue,
          r.status,
        ]);
      }
      ws.addRow([]);
      const sum = ws.addRow(['TOTALS', '', '', '', rep.summary.totalQty, '', '', rep.summary.totalAssetValue, '']);
      sum.font = { bold: true };
      this.formatCurrencyColumns(ws, [6, 7, 8], cur);
    }
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
