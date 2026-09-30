import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPiItem {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number; // in the PI currency
  amount: number;
}

/** Proforma invoice received from the supplier before the LC is opened. */
export interface IProformaInvoice extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  piNumber: string; // PI-2026-0001
  supplierPiNo?: string; // the supplier's own reference
  supplierId: Types.ObjectId; // Ref: suppliers
  lcId?: Types.ObjectId | null; // Ref: letters_of_credit
  currency: string;
  exchangeRate: number;
  items: IPiItem[];
  goodsValue: number; // in currency
  freightCost: number; // in currency
  insuranceCost: number; // in currency
  totalValue: number; // in currency
  totalValueBdt: number;
  incoterms?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  expectedShipmentDate?: Date | null;
  status: 'DRAFT' | 'APPROVED' | 'LC_OPENED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PiItemSchema = new Schema<IPiItem>(
  {
    description: { type: String, required: true, trim: true, maxlength: 300 },
    hsnCode: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true, trim: true, default: 'Pcs' },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const ProformaInvoiceSchema = new Schema<IProformaInvoice>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    piNumber: { type: String, required: true, trim: true },
    supplierPiNo: { type: String, trim: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    lcId: { type: Schema.Types.ObjectId, ref: 'LetterOfCredit', default: null },
    currency: { type: String, required: true, trim: true, uppercase: true, default: 'USD' },
    exchangeRate: { type: Number, required: true, min: 0, default: 1 },
    items: {
      type: [PiItemSchema],
      required: true,
      validate: [(v: IPiItem[]) => v.length > 0, 'A proforma invoice needs at least one item'],
    },
    goodsValue: { type: Number, required: true, min: 0, default: 0 },
    freightCost: { type: Number, min: 0, default: 0 },
    insuranceCost: { type: Number, min: 0, default: 0 },
    totalValue: { type: Number, required: true, min: 0, default: 0 },
    totalValueBdt: { type: Number, required: true, min: 0, default: 0 },
    incoterms: { type: String, trim: true, uppercase: true },
    portOfLoading: { type: String, trim: true },
    portOfDischarge: { type: String, trim: true },
    expectedShipmentDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'LC_OPENED', 'SHIPPED', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'proforma_invoices' }
);

ProformaInvoiceSchema.index({ orgId: 1, piNumber: 1 }, { unique: true });
ProformaInvoiceSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const ProformaInvoice = mongoose.model<IProformaInvoice>('ProformaInvoice', ProformaInvoiceSchema);
