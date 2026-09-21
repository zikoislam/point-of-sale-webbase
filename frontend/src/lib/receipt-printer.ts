/**
 * Receipt printing.
 *
 * A thermal printer needs raw ESC/POS bytes, not a print dialog, so on the
 * desktop this builds the byte stream here and hands it to the Electron shell
 * (or to the local API when the web build runs on the till computer). In a
 * plain browser on a remote machine neither is available and the caller falls
 * back to the browser print dialog.
 */

import { EscposBuilder, ReceiptData } from './escpos-builder';
import { electronBridge, isElectron, type HardwareResult } from './electron-bridge';
import { api } from './api-client';

export interface ReceiptBranding {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  currencySymbol?: string;
}

export interface PrintReceiptOptions {
  paperWidth?: '58mm' | '80mm';
  printerName?: string;
  footerText?: string;
  docName?: string;
  /** Kick the drawer as part of the same job (cash sales). */
  openDrawer?: boolean;
  /** 'thermal' = raw ESC/POS, 'document' = ordinary printer (A4). */
  printMode?: 'thermal' | 'document';
  /** Printer for the document path; blank uses the Windows default. */
  documentPrinterName?: string;
  paperSize?: 'A4' | 'Letter';
  /** true opens the Windows print dialog instead of printing straight through. */
  showPrintDialog?: boolean;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Maps a sale document onto the receipt layout. */
export function buildReceiptData(
  sale: any,
  branding: ReceiptBranding = {},
  footerText?: string
): ReceiptData {
  const payments: any[] = Array.isArray(sale?.payments) ? sale.payments : [];
  const paymentMethod = payments.length
    ? payments.map((payment) => payment.method || payment.paymentMethod).filter(Boolean).join(' + ')
    : sale?.paymentMethod || 'CASH';

  const date = sale?.createdAt ? new Date(sale.createdAt) : new Date();

  return {
    shopName: branding.shopName || 'POS STORE',
    shopAddress: branding.shopAddress,
    shopPhone: branding.shopPhone,
    invoiceNo: String(sale?.invoiceNo || ''),
    date: date.toLocaleString(),
    cashierName: sale?.cashierName || sale?.cashier?.name || '',
    customerName: sale?.customerName || sale?.customer?.name,
    items: (Array.isArray(sale?.items) ? sale.items : []).map((item: any) => ({
      productName: item.productName || item.name || '',
      variantName: item.variantName,
      quantity: num(item.quantity),
      unitPrice: num(item.unitSellingPrice ?? item.unitPrice),
      lineTotal: num(item.lineTotal),
    })),
    subtotal: num(sale?.subtotal),
    taxAmount: num(sale?.taxAmount),
    discountAmount: num(sale?.discountAmount),
    grandTotal: num(sale?.totalAmount ?? sale?.grandTotal),
    paidAmount: num(sale?.paidAmount ?? sale?.totalAmount),
    paymentMethod: paymentMethod || 'CASH',
    changeReturned: num(sale?.changeReturned),
    footerText,
  };
}

/** ESC/POS byte stream for a sale receipt. */
export function buildReceiptBytes(
  sale: any,
  branding: ReceiptBranding = {},
  options: PrintReceiptOptions = {}
): number[] {
  const data = buildReceiptData(sale, branding, options.footerText);
  return Array.from(EscposBuilder.buildReceipt(data, options.paperWidth || '80mm'));
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toBreaks = (value: unknown): string => escapeHtml(value).replace(/\r?\n/g, '<br />');

/**
 * Full-page invoice for an ordinary printer.
 *
 * This deliberately does not reuse the ESC/POS layout: an A4 sheet has room for
 * a proper header, an item table and a totals block, and the page is rendered by
 * the printer's own driver rather than by escape codes.
 */
export function buildReceiptHtml(
  sale: any,
  branding: ReceiptBranding = {},
  options: PrintReceiptOptions = {}
): string {
  const data = buildReceiptData(sale, branding, options.footerText);
  const currency = branding.currencySymbol || '৳';
  const money = (amount: number) => `${currency}${amount.toFixed(2)}`;
  const paperSize = options.paperSize || 'A4';

  const rows = data.items
    .map(
      (item, index) => `
        <tr>
          <td class="idx">${index + 1}</td>
          <td>
            ${escapeHtml(item.productName)}
            ${item.variantName ? `<div class="variant">${escapeHtml(item.variantName)}</div>` : ''}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${money(item.unitPrice)}</td>
          <td class="num">${money(item.lineTotal)}</td>
        </tr>`
    )
    .join('');

  const totals: string[] = [
    `<tr><td>Subtotal</td><td class="num">${money(data.subtotal)}</td></tr>`,
  ];

  if (data.discountAmount && data.discountAmount > 0) {
    totals.push(`<tr><td>Discount</td><td class="num">-${money(data.discountAmount)}</td></tr>`);
  }
  if (data.taxAmount > 0) {
    totals.push(`<tr><td>Tax (VAT)</td><td class="num">${money(data.taxAmount)}</td></tr>`);
  }

  totals.push(`<tr class="grand"><td>Grand Total</td><td class="num">${money(data.grandTotal)}</td></tr>`);
  totals.push(
    `<tr><td>Paid (${escapeHtml(data.paymentMethod)})</td><td class="num">${money(data.paidAmount)}</td></tr>`
  );

  if (data.changeReturned > 0) {
    totals.push(`<tr><td>Change returned</td><td class="num">${money(data.changeReturned)}</td></tr>`);
  }

  const footer = data.footerText
    ? toBreaks(data.footerText)
    : 'Thank you for shopping with us!';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.invoiceNo)}</title>
<style>
  @page { size: ${paperSize}; margin: 12mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    color: #111827;
    font-family: "Segoe UI", "Nirmala UI", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    border-bottom: 2px solid #111827;
    padding-bottom: 12px;
  }

  .shop { font-size: 21px; font-weight: 700; letter-spacing: -0.2px; }
  .shop-detail { margin-top: 4px; color: #4b5563; font-size: 11.5px; }

  .meta { text-align: right; font-size: 11.5px; line-height: 1.75; white-space: nowrap; }
  .meta .k { color: #6b7280; }

  .title {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin: 16px 0 4px;
  }

  .parties { display: flex; gap: 24px; margin: 10px 0 16px; }
  .parties > div { flex: 1; }

  .label {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #6b7280;
    margin-bottom: 3px;
  }

  table { width: 100%; border-collapse: collapse; }

  thead th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #374151;
    border-bottom: 1px solid #9ca3af;
    padding: 7px 8px;
  }

  tbody td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f9fafb; }

  .idx { color: #9ca3af; width: 30px; }
  .variant { color: #6b7280; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; }

  .totals { width: 72mm; margin-left: auto; margin-top: 14px; }
  .totals td { padding: 5px 8px; }
  .totals td:last-child { text-align: right; white-space: nowrap; }
  .totals .grand td {
    border-top: 2px solid #111827;
    border-bottom: 2px solid #111827;
    font-size: 15px;
    font-weight: 700;
    padding: 8px;
  }

  .footer {
    margin-top: 26px;
    padding-top: 12px;
    border-top: 1px dashed #9ca3af;
    text-align: center;
    color: #374151;
    font-size: 11.5px;
  }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="shop">${escapeHtml(data.shopName)}</div>
      <div class="shop-detail">
        ${data.shopAddress ? `${escapeHtml(data.shopAddress)}<br />` : ''}
        ${data.shopPhone ? `Tel: ${escapeHtml(data.shopPhone)}` : ''}
      </div>
    </div>
    <div class="meta">
      <div><span class="k">Invoice</span> <strong>${escapeHtml(data.invoiceNo)}</strong></div>
      <div><span class="k">Date</span> ${escapeHtml(data.date)}</div>
      ${data.cashierName ? `<div><span class="k">Cashier</span> ${escapeHtml(data.cashierName)}</div>` : ''}
    </div>
  </div>

  <div class="title">Sales Invoice</div>

  <div class="parties">
    <div>
      <div class="label">Billed to</div>
      <div>${escapeHtml(data.customerName || 'Walk-in customer')}</div>
    </div>
    <div>
      <div class="label">Payment</div>
      <div>${escapeHtml(data.paymentMethod)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th class="num" style="width:56px">Qty</th>
        <th class="num" style="width:88px">Rate</th>
        <th class="num" style="width:98px">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">${totals.join('')}</table>

  <div class="footer">${footer}</div>
</body>
</html>`;
}

/** Browser fallback for the document path: show the page, then print it. */
function openPrintWindow(html: string): HardwareResult {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Printing is not available here.' };
  }

  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (!popup) {
    return { success: false, error: 'The browser blocked the print window. Allow pop-ups for this site.' };
  }

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();

  // Give the popup a moment to lay the page out before the dialog opens.
  setTimeout(() => popup.print(), 400);

  return { success: true, printerName: 'the browser print dialog' };
}

/**
 * Sends an HTML page to an ordinary printer.
 *
 * Desktop: rendered by Chromium and handed to the printer's own driver.
 * Browser: opened in a popup, where the user gets the normal print dialog —
 * a plain browser has no way to reach the spooler directly.
 */
export async function sendDocument(
  html: string,
  options: PrintReceiptOptions = {}
): Promise<HardwareResult> {
  if (isElectron()) {
    return electronBridge.printDocument({
      html,
      printerName: options.documentPrinterName,
      paperSize: options.paperSize,
      silent: options.showPrintDialog === undefined ? undefined : !options.showPrintDialog,
    });
  }

  return openPrintWindow(html);
}

/**
 * Sends a sale receipt to the printer.
 *
 * Returns `{ success: false }` when no raw-printing path exists, which is the
 * caller's signal to fall back to `window.print()`.
 */
export async function printSaleReceipt(
  sale: any,
  branding: ReceiptBranding = {},
  options: PrintReceiptOptions = {}
): Promise<HardwareResult> {
  if (options.openDrawer) {
    void electronBridge.openCashDrawer({ printerName: options.printerName });
  }

  // Ordinary printer: lay the receipt out as a page and let the driver print it.
  if (options.printMode === 'document') {
    return sendDocument(buildReceiptHtml(sale, branding, options), options);
  }

  // Thermal printer: raw ESC/POS bytes, no driver involved.
  const bytes = buildReceiptBytes(sale, branding, options);
  const docName = options.docName || `Receipt ${sale?.invoiceNo || ''}`.trim();

  if (isElectron()) {
    return electronBridge.printReceipt({
      bytes,
      printerName: options.printerName,
      docName,
    });
  }

  // Web build running on the till computer itself — the API can reach the
  // spooler even without the desktop shell.
  try {
    await api.post('/hardware/print', {
      bytes,
      printerName: options.printerName,
      docName,
    });
    return { success: true, bytes: bytes.length };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Raw printing is not available here' };
  }
}

/** Installed printers, or an empty list when not running on the desktop. */
export async function availablePrinters(): Promise<{ name: string; isDefault: boolean }[]> {
  if (isElectron()) return electronBridge.listPrinters();

  try {
    const response = await api.get<{ printers: { name: string; isDefault: boolean }[] }>(
      '/hardware/printers'
    );
    return response.data?.printers ?? [];
  } catch {
    return [];
  }
}

/** A one-page test sheet for an ordinary printer. */
export function buildTestPageHtml(shopName: string, options: PrintReceiptOptions = {}): string {
  const paperSize = options.paperSize || 'A4';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Printer Test</title>
<style>
  @page { size: ${paperSize}; margin: 14mm; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Nirmala UI", Arial, sans-serif;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .box { border: 2px solid #111827; border-radius: 8px; padding: 26px 30px; }
  .shop { font-size: 22px; font-weight: 700; }
  h1 { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; margin: 16px 0 18px; }
  table { border-collapse: collapse; font-size: 12.5px; }
  td { padding: 5px 0; }
  td:first-child { color: #6b7280; width: 130px; }
  .ok { margin-top: 20px; font-size: 13px; font-weight: 600; }
  .note { margin-top: 6px; font-size: 11.5px; color: #4b5563; }
</style>
</head>
<body>
  <div class="box">
    <div class="shop">${escapeHtml(shopName || 'UNIQUE POS')}</div>
    <h1>Printer test</h1>
    <table>
      <tr><td>Printed at</td><td>${escapeHtml(new Date().toLocaleString())}</td></tr>
      <tr><td>Paper size</td><td>${escapeHtml(paperSize)}</td></tr>
      <tr><td>Output</td><td>Ordinary printer (driver rendered)</td></tr>
    </table>
    <div class="ok">If you can read this, the printer is set up correctly.</div>
    <div class="note">Receipts will print on ${escapeHtml(paperSize)} paper from now on.</div>
  </div>
</body>
</html>`;
}

/** A short slip used to confirm the printer, paper width and drawer wiring. */
export async function printTestSlip(
  shopName: string,
  options: PrintReceiptOptions = {}
): Promise<HardwareResult> {
  if (options.printMode === 'document') {
    return sendDocument(buildTestPageHtml(shopName, options), options);
  }

  const builder = new EscposBuilder(options.paperWidth || '80mm');

  builder.align('center').bold(true).size(true, true);
  builder.line(shopName || 'UNIQUE POS');
  builder.bold(false).size(false, false);
  builder.line('Printer test');
  builder.separator('-');
  builder.align('left');
  builder.line(new Date().toLocaleString());
  builder.line('If you can read this, the receipt');
  builder.line('printer is set up correctly.');
  builder.separator('-');
  builder.align('center');
  builder.line('ESC/POS ready');
  builder.feed(3);
  builder.cut();

  const bytes = Array.from(builder.getBinary());

  if (isElectron()) {
    return electronBridge.printReceipt({
      bytes,
      printerName: options.printerName,
      docName: 'Printer Test',
    });
  }

  try {
    await api.post('/hardware/print', { bytes, printerName: options.printerName, docName: 'Printer Test' });
    return { success: true, bytes: bytes.length };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Raw printing is not available here' };
  }
}
