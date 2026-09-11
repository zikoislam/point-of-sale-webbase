/**
 * ESC/POS Command & Binary Builder
 * Formats receipts for standard 58mm (32 chars) and 80mm (48 chars) thermal printers
 */

export interface ReceiptItem {
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  invoiceNo: string;
  date: string;
  cashierName: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: string;
  changeReturned: number;
  footerText?: string;
}

export class EscposBuilder {
  private buffer: number[] = [];
  private lineWidth: number;

  constructor(paperWidth: '58mm' | '80mm' = '80mm') {
    this.lineWidth = paperWidth === '58mm' ? 32 : 48;
    this.init();
  }

  init(): this {
    this.buffer.push(0x1b, 0x40); // ESC @ - Initialize printer
    return this;
  }

  align(align: 'left' | 'center' | 'right'): this {
    const code = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, code); // ESC a n
    return this;
  }

  bold(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  size(doubleWidth: boolean = false, doubleHeight: boolean = false): this {
    let n = 0;
    if (doubleWidth) n |= 0x20;
    if (doubleHeight) n |= 0x01;
    this.buffer.push(0x1d, 0x21, n); // GS ! n
    return this;
  }

  text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  line(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  separator(char: string = '-'): this {
    this.align('left');
    this.line(char.repeat(this.lineWidth));
    return this;
  }

  twoColumn(left: string, right: string): this {
    const spaceCount = Math.max(1, this.lineWidth - left.length - right.length);
    this.align('left');
    this.line(left + ' '.repeat(spaceCount) + right);
    return this;
  }

  feed(lines: number = 3): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  cut(): this {
    this.buffer.push(0x1d, 0x56, 0x41, 0x03); // GS V A 3 (Full Cut with feed)
    return this;
  }

  openCashDrawer(): this {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
    return this;
  }

  getBinary(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Build complete formatted sale receipt
   */
  static buildReceipt(data: ReceiptData, paperWidth: '58mm' | '80mm' = '80mm'): Uint8Array {
    const builder = new EscposBuilder(paperWidth);

    // Header
    builder.align('center');
    builder.bold(true).size(true, true);
    builder.line(data.shopName);
    builder.bold(false).size(false, false);

    if (data.shopAddress) builder.line(data.shopAddress);
    if (data.shopPhone) builder.line(`Tel: ${data.shopPhone}`);

    builder.separator('=');

    // Metadata
    builder.align('left');
    builder.twoColumn(`Invoice: ${data.invoiceNo}`, data.date);
    builder.line(`Cashier: ${data.cashierName}`);
    if (data.customerName) {
      builder.line(`Customer: ${data.customerName}`);
    }

    builder.separator('-');

    // Line items
    builder.bold(true);
    if (paperWidth === '80mm') {
      builder.twoColumn('Item Description', 'Qty x Price   Total');
    } else {
      builder.twoColumn('Item', 'Total');
    }
    builder.bold(false);
    builder.separator('-');

    for (const item of data.items) {
      const name = item.variantName
        ? `${item.productName} (${item.variantName})`
        : item.productName;
      
      builder.line(name);
      const subInfo = `${item.quantity} x ৳${item.unitPrice.toFixed(2)}`;
      const totalInfo = `৳${item.lineTotal.toFixed(2)}`;
      builder.twoColumn(`  ${subInfo}`, totalInfo);
    }

    builder.separator('-');

    // Totals
    builder.twoColumn('Subtotal:', `৳${data.subtotal.toFixed(2)}`);
    if (data.taxAmount > 0) {
      builder.twoColumn('Tax (VAT):', `৳${data.taxAmount.toFixed(2)}`);
    }
    if (data.discountAmount && data.discountAmount > 0) {
      builder.twoColumn('Discount:', `-৳${data.discountAmount.toFixed(2)}`);
    }

    builder.separator('=');
    builder.bold(true).size(true, false);
    builder.twoColumn('GRAND TOTAL:', `৳${data.grandTotal.toFixed(2)}`);
    builder.bold(false).size(false, false);
    builder.separator('=');

    // Payment details
    builder.twoColumn(`Paid (${data.paymentMethod}):`, `৳${data.paidAmount.toFixed(2)}`);
    if (data.changeReturned > 0) {
      builder.twoColumn('Change Returned:', `৳${data.changeReturned.toFixed(2)}`);
    }

    builder.separator('-');

    // Footer
    builder.align('center');
    if (data.footerText) {
      builder.line(data.footerText);
    } else {
      builder.line('Thank you for shopping with us!');
      builder.line('Please visit again.');
    }

    builder.feed(3);
    builder.cut();

    return builder.getBinary();
  }
}
