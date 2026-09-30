import mongoose, { Document, Schema, Types } from 'mongoose';

export const LC_STATUSES = [
  'DRAFT',
  'OPENED',
  'SHIPPED',
  'RECEIVED',
  'RETIRED',
  'CANCELLED',
] as const;

export type LcStatus = (typeof LC_STATUSES)[number];

export interface ILcCharge {
  label: string;
  amount: number; // in BDT
}

/** A Letter of Credit opened with a bank for an import/export shipment. */
export interface ILetterOfCredit extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  lcNumber: string; // LC-2026-0001
  /** IMPORT = we buy from abroad, EXPORT = we sell abroad. */
  lcType: 'IMPORT' | 'EXPORT';
  beneficiarySupplierId?: Types.ObjectId | null; // Ref: suppliers (foreign supplier)
  buyerCustomerId?: Types.ObjectId | null; // Ref: customers (for exports)
  issuingBank: string;
  bankBranch?: string;
  bankRefNo?: string;
  currency: string; // USD | EUR | CNY | BDT
  exchangeRate: number; // BDT per unit of currency
  lcAmount: number; // in `currency`
  /** BDT equivalent frozen at issue time. */
  lcAmountBdt: number;
  issueDate: Date;
  expiryDate?: Date | null;
  latestShipmentDate?: Date | null;
  incoterms?: string; // FOB | CIF | CFR | EXW
  portOfLoading?: string;
  portOfDischarge?: string;
  /** Bank + insurance + other charges that make up the landed cost. */
  charges: ILcCharge[];
  totalCharges: number;
  marginPercent?: number; // cash margin kept with the bank
  status: LcStatus;
  /** Free-form paperwork checklist (B/L, invoice, packing list…). */
  documentsReceived: string[];
  notes?: string;
  createdBy: Types.ObjectId; // Ref: users
  statusHistory: Array<{ status: LcStatus; at: Date; by: Types.ObjectId; note?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const LcChargeSchema = new Schema<ILcCharge>(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const LetterOfCreditSchema = new Schema<ILetterOfCredit>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    lcNumber: { type: String, required: true, trim: true },
    lcType: { type: String, enum: ['IMPORT', 'EXPORT'], default: 'IMPORT', required: true },
    beneficiarySupplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
    buyerCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    issuingBank: { type: String, required: true, trim: true, maxlength: 160 },
    bankBranch: { type: String, trim: true, maxlength: 160 },
    bankRefNo: { type: String, trim: true, maxlength: 80 },
    currency: { type: String, required: true, trim: true, uppercase: true, default: 'USD' },
    exchangeRate: { type: Number, required: true, min: 0, default: 1 },
    lcAmount: { type: Number, required: true, min: 0 },
    lcAmountBdt: { type: Number, required: true, min: 0, default: 0 },
    issueDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, default: null },
    latestShipmentDate: { type: Date, default: null },
    incoterms: { type: String, trim: true, uppercase: true },
    portOfLoading: { type: String, trim: true },
    portOfDischarge: { type: String, trim: true },
    charges: { type: [LcChargeSchema], default: [] },
    totalCharges: { type: Number, default: 0, min: 0 },
    marginPercent: { type: Number, min: 0, max: 100 },
    status: {
      type: String,
      enum: LC_STATUSES,
      default: 'DRAFT',
      required: true,
      index: true,
    },
    documentsReceived: { type: [String], default: [] },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, enum: LC_STATUSES, required: true },
            at: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            note: { type: String, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false, collection: 'letters_of_credit' }
);

LetterOfCreditSchema.index({ orgId: 1, lcNumber: 1 }, { unique: true });
LetterOfCreditSchema.index({ orgId: 1, status: 1, issueDate: -1 });

export const LetterOfCredit = mongoose.model<ILetterOfCredit>('LetterOfCredit', LetterOfCreditSchema);
