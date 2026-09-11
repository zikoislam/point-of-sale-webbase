import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISaleItem {
  variantId: Types.ObjectId;
  productName: string; // Snapshot
  variantName: string; // Snapshot
  sku: string; // Snapshot
  barcode?: string; // Snapshot
  quantity: number;
  unitCostPrice: number; // Snapshot for accurate COGS
  unitSellingPrice: number; // Snapshot of applied price
  taxRate: number; // Snapshot VAT %
  taxAmount: number; // Line VAT sum
  discount: number; // Line discount
  lineTotal: number; // Net payable for this line
}

export interface IPaymentRecord {
  method: 'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD' | 'STORE_CREDIT' | 'CUSTOMER_DUE';
  amount: number;
  accountId?: Types.ObjectId; // Ref: accounts
  transactionRef?: string; // Card auth code, bKash TxID, or Voucher code
}

export interface ISale extends Document {
  _id: Types.ObjectId;
  invoiceNo: string; // Unique, e.g. "INV-20260907-00001"
  shiftId: Types.ObjectId; // Ref: shifts
  cashierId: Types.ObjectId; // Ref: users
  customerId?: Types.ObjectId; // Ref: customers (Walk-in if null)
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: ISaleItem[];
  subtotal: number; // Pre-tax, pre-discount total
  totalTax: number; // Accumulated VAT
  discountAmount: number; // Bill-level discount sum
  totalAmount: number; // Net bill total
  paidAmount: number; // Total tendered
  changeReturned: number; // Cash change handed back
  dueAmount: number; // Outstanding debt for customer credit
  payments: IPaymentRecord[]; // Split payment breakdown
  isOfflineSynced: boolean; // Set to true if queued via IndexedDB
  idempotencyKey: string; // Unique UUID to stop duplicate billing
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitCostPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    unitSellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    method: {
      type: String,
      enum: ['CASH', 'CARD', 'MFS_BKASH', 'MFS_NAGAD', 'STORE_CREDIT', 'CUSTOMER_DUE'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    transactionRef: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    cashierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    pricingTier: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE'],
      required: true,
      default: 'RETAIL',
    },
    items: {
      type: [SaleItemSchema],
      required: true,
      validate: [(val: ISaleItem[]) => val.length > 0, 'Sale must contain at least one item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    changeReturned: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    dueAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    payments: {
      type: [PaymentRecordSchema],
      required: true,
      validate: [(val: IPaymentRecord[]) => val.length > 0, 'Sale must have at least one payment record'],
    },
    isOfflineSynced: {
      type: Boolean,
      default: false,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'sales',
  }
);

// Indexes
SaleSchema.index({ shiftId: 1, createdAt: -1 });
SaleSchema.index({ customerId: 1, createdAt: -1 });
SaleSchema.index({ createdAt: -1 });

export const Sale = mongoose.model<ISale>('Sale', SaleSchema);
