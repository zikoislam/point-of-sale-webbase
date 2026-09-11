/**
 * Server-side ESC/POS Receipt Formatter
 * Generates raw ESC/POS binary buffers or clean HTML receipt documents
 */

export interface ReceiptDataInput {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  invoiceNo: string;
  date: string;
  cashierName: string;
  customerName?: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  change: number;
  paymentMethod: string;
  footerText?: string;
}

export class EscposFormatter {
  static toEscposBinary(data: ReceiptDataInput, paperWidth: '58mm' | '80mm' = '80mm'): Buffer {
    const bytes: number[] = [];
    const lineWidth = paperWidth === '58mm' ? 32 : 48;

    const pushBytes = (...arr: number[]) => bytes.push(...arr);
    const pushText = (str: string) => {
      const b = Buffer.from(str, 'utf8');
      for (let i = 0; i < b.length; i++) bytes.push(b[i]);
    };
    const pushLine = (str: string = '') => {
      pushText(str);
      pushBytes(0x0a);
    };
    const twoCol = (left: string, right: string) => {
      const space = Math.max(1, lineWidth - left.length - right.length);
      pushLine(left + ' '.repeat(space) + right);
    };

    // Initialize
    pushBytes(0x1b, 0x40);

    // Center header
    pushBytes(0x1b, 0x61, 0x01); // Center
    pushBytes(0x1b, 0x45, 0x01); // Bold
    pushBytes(0x1d, 0x21, 0x11); // Double size
    pushLine(data.shopName);
    pushBytes(0x1d, 0x21, 0x00); // Normal size
    pushBytes(0x1b, 0x45, 0x00); // Normal weight

    if (data.shopAddress) pushLine(data.shopAddress);
    if (data.shopPhone) pushLine(`Tel: ${data.shopPhone}`);

    // Separator
    pushBytes(0x1b, 0x61, 0x00); // Left align
    pushLine('='.repeat(lineWidth));

    twoCol(`Inv: ${data.invoiceNo}`, data.date);
    pushLine(`Cashier: ${data.cashierName}`);
    if (data.customerName) pushLine(`Customer: ${data.customerName}`);

    pushLine('-'.repeat(lineWidth));

    for (const item of data.items) {
      pushLine(item.name);
      twoCol(`  ${item.quantity} x ${item.price.toFixed(2)}`, item.total.toFixed(2));
    }

    pushLine('-'.repeat(lineWidth));
    twoCol('Subtotal:', data.subtotal.toFixed(2));
    if (data.tax > 0) twoCol('Tax (VAT):', data.tax.toFixed(2));
    if (data.discount > 0) twoCol('Discount:', `-${data.discount.toFixed(2)}`);

    pushLine('='.repeat(lineWidth));
    pushBytes(0x1b, 0x45, 0x01); // Bold
    twoCol('TOTAL PAYABLE:', `BDT ${data.grandTotal.toFixed(2)}`);
    pushBytes(0x1b, 0x45, 0x00); // Normal
    pushLine('='.repeat(lineWidth));

    twoCol(`Paid (${data.paymentMethod}):`, data.paidAmount.toFixed(2));
    if (data.change > 0) twoCol('Change:', data.change.toFixed(2));

    pushLine('-'.repeat(lineWidth));
    pushBytes(0x1b, 0x61, 0x01); // Center
    pushLine(data.footerText || 'Thank you for your business!');
    pushLine('Please visit us again.');

    // Feed & paper cut
    pushBytes(0x0a, 0x0a, 0x0a);
    pushBytes(0x1d, 0x56, 0x41, 0x03);

    return Buffer.from(bytes);
  }

  static toHtml(data: ReceiptDataInput): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${data.invoiceNo}</title>
  <style>
    body { font-family: monospace; font-size: 12px; margin: 0; padding: 15px; color: #000; width: 300px; }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; }
    .flex-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .grand { font-size: 15px; font-weight: bold; margin: 6px 0; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="bold" style="font-size: 16px;">${data.shopName}</div>
    ${data.shopAddress ? `<div>${data.shopAddress}</div>` : ''}
    ${data.shopPhone ? `<div>Tel: ${data.shopPhone}</div>` : ''}
  </div>
  <div class="sep"></div>
  <div class="flex-row"><span>Inv: ${data.invoiceNo}</span><span>${data.date}</span></div>
  <div class="flex-row"><span>Cashier:</span><span>${data.cashierName}</span></div>
  ${data.customerName ? `<div class="flex-row"><span>Customer:</span><span>${data.customerName}</span></div>` : ''}
  <div class="sep"></div>
  ${data.items.map(i => `
    <div>${i.name}</div>
    <div class="flex-row" style="padding-left: 10px; color: #444;">
      <span>${i.quantity} x ${i.price.toFixed(2)}</span>
      <span class="bold">${i.total.toFixed(2)}</span>
    </div>
  `).join('')}
  <div class="sep"></div>
  <div class="flex-row"><span>Subtotal:</span><span>${data.subtotal.toFixed(2)}</span></div>
  ${data.tax > 0 ? `<div class="flex-row"><span>VAT:</span><span>${data.tax.toFixed(2)}</span></div>` : ''}
  ${data.discount > 0 ? `<div class="flex-row"><span>Discount:</span><span>-${data.discount.toFixed(2)}</span></div>` : ''}
  <div class="sep"></div>
  <div class="flex-row grand"><span>TOTAL:</span><span>BDT ${data.grandTotal.toFixed(2)}</span></div>
  <div class="flex-row"><span>Paid (${data.paymentMethod}):</span><span>${data.paidAmount.toFixed(2)}</span></div>
  ${data.change > 0 ? `<div class="flex-row"><span>Change:</span><span>${data.change.toFixed(2)}</span></div>` : ''}
  <div class="sep"></div>
  <div class="text-center" style="margin-top: 10px;">
    <div>${data.footerText || 'Thank you for shopping with us!'}</div>
  </div>
</body>
</html>`;
  }
}
