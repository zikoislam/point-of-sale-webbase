import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICiItem {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number; // in currency
  amount: number; // in currency
  /** Optional link to the internal product being received. */
  productId?: Types.ObjectId | null;
  variantId?: Types.ObjectId | null;
  /** Landed unit cost in BDT, filled in when the shipment is cleared. */
  landedUnitCost?: number | null;
  goodsCostBdt?: number | null;
  allocatedFreight?: number | null;
  allocatedDuty?: number | null;
  allocatedOther?: number | null;
}

/**
 * Commercial invoice from the supplier — the document that turns an LC into
 * real stock. Clearing it computes the landed cost per item and (optionally)
 * writes that cost onto the product variants.
 */
export interface ICommercialInvoice extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  ciNumber: string; // CI-2026-0001
  supplierCiNo?: string;
  lcId?: Types.ObjectId | null;
  piId?: Types.ObjectId | null;
  supplierId: Types.ObjectId;
  invoiceDate: Date;
  currency: string;
  exchangeRate: number;
  items: ICiItem[];
  goodsValue: number; // in currency
  goodsValueBdt: number;
  /** BDT amounts added on top of the goods value. */
  freightCostBdt: number;
  insuranceCostBdt: number;
  dutyAmountBdt: number;
  vatAmountBdt: number;
  otherChargesBdt: number;
  lcChargesBdt: number;
  cnfChargesBdt: number;
  /** goods + freight + insurance + duty + vat + other + lc + cnf */
  landedCostBdt: number;
  landedCostPerItem: number; // average, for a quick sanity check
  shipping: {
    blNumber?: string;
    blDate?: Date | null;
    vesselName?: string;
    containerNo?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    arrivalDate?: Date | null;
  };
  /** Allocation basis for freight/duty when a shipment has mixed items. */
  allocationBasis: 'VALUE' | 'QUANTITY';
  status: 'DRAFT' | 'SHIPPED' | 'ARRIVED' | 'CUSTOMS' | 'CLEARED' | 'CANCELLED';
  /** Set once the stock + cost have been applied to the products. */
  costApplied: boolean;
  costAppliedAt?: Date | null;
  costAppliedBy?: Types.ObjectId | null;
  stockPosted: boolean;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CiItemSchema = new Schema<ICiItem>(
  {
    description: { type: String, required: true, trim: true, maxlength: 300 },
    hsnCode: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true, trim: true, default: 'Pcs' },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0, default: 0 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    variantId: { type: Schema.Types.ObjectId, default: null },
    landedUnitCost: { type: Number, default: null },
    goodsCostBdt: { type: Number, default: null },
    allocatedFreight: { type: Number, default: null },
    allocatedDuty: { type: Number, default: null },
    allocatedOther: { type: Number, default: null },
  },
  { _id: false }
);

const CommercialInvoiceSchema = new Schema<ICommercialInvoice>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    ciNumber: { type: String, required: true, trim: true },
    supplierCiNo: { type: String, trim: true },
    lcId: { type: Schema.Types.ObjectId, ref: 'LetterOfCredit', default: null, index: true },
    piId: { type: Schema.Types.ObjectId, ref: 'ProformaInvoice', default: null },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    invoiceDate: { type: Date, required: true, default: Date.now },
    currency: { type: String, required: true, trim: true, uppercase: true, default: 'USD' },
    exchangeRate: { type: Number, required: true, min: 0, default: 1 },
    items: {
      type: [CiItemSchema],
      required: true,
      validate: [(v: ICiItem[]) => v.length > 0, 'A commercial invoice needs at least one item'],
    },
    goodsValue: { type: Number, required: true, min: 0, default: 0 },
    goodsValueBdt: { type: Number, required: true, min: 0, default: 0 },
    freightCostBdt: { type: Number, min: 0, default: 0 },
    insuranceCostBdt: { type: Number, min: 0, default: 0 },
    dutyAmountBdt: { type: Number, min: 0, default: 0 },
    vatAmountBdt: { type: Number, min: 0, default: 0 },
    otherChargesBdt: { type: Number, min: 0, default: 0 },
    lcChargesBdt: { type: Number, min: 0, default: 0 },
    cnfChargesBdt: { type: Number, min: 0, default: 0 },
    landedCostBdt: { type: Number, min: 0, default: 0 },
    landedCostPerItem: { type: Number, min: 0, default: 0 },
    shipping: {
      blNumber: { type: String, trim: true },
      blDate: { type: Date, default: null },
      vesselName: { type: String, trim: true },
      containerNo: { type: String, trim: true },
      portOfLoading: { type: String, trim: true },
      portOfDischarge: { type: String, trim: true },
      arrivalDate: { type: Date, default: null },
    },
    allocationBasis: { type: String, enum: ['VALUE', 'QUANTITY'], default: 'VALUE', required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'SHIPPED', 'ARRIVED', 'CUSTOMS', 'CLEARED', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    costApplied: { type: Boolean, default: false },
    costAppliedAt: { type: Date, default: null },
    costAppliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    stockPosted: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'commercial_invoices' }
);

CommercialInvoiceSchema.index({ orgId: 1, ciNumber: 1 }, { unique: true });
CommercialInvoiceSchema.index({ orgId: 1, status: 1, invoiceDate: -1 });

export const CommercialInvoice = mongoose.model<ICommercialInvoice>('CommercialInvoice', CommercialInvoiceSchema);
