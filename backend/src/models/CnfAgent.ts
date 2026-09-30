import mongoose, { Document, Schema, Types } from 'mongoose';

/** Freight forwarder or C&F agent used to clear import shipments. */
export interface ICnfAgent extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  agentType: 'FREIGHT_FORWARDER' | 'CNF_AGENT' | 'BOTH';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNo?: string;
  /** Positive = we owe the agent. */
  currentPayable: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CnfAgentSchema = new Schema<ICnfAgent>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    agentType: {
      type: String,
      enum: ['FREIGHT_FORWARDER', 'CNF_AGENT', 'BOTH'],
      default: 'CNF_AGENT',
      required: true,
    },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true, maxlength: 300 },
    licenseNo: { type: String, trim: true },
    currentPayable: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'cnf_agents' }
);

CnfAgentSchema.index({ orgId: 1, name: 1 });

export const CnfAgent = mongoose.model<ICnfAgent>('CnfAgent', CnfAgentSchema);

/** Charge (payable up) or payment (payable down) against a C&F agent. */
export interface ICnfAgentLedger extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  entryType: 'CHARGE' | 'PAYMENT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  /** Where the charge came from (a commercial invoice, or a manual entry). */
  referenceType?: 'COMMERCIAL_INVOICE' | 'MANUAL';
  referenceId?: Types.ObjectId | null;
  narration: string;
  entryDate: Date;
  recordedById: Types.ObjectId;
  createdAt: Date;
}

const CnfAgentLedgerSchema = new Schema<ICnfAgentLedger>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    agentId: { type: Schema.Types.ObjectId, ref: 'CnfAgent', required: true, index: true },
    entryType: { type: String, enum: ['CHARGE', 'PAYMENT'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    balanceBefore: { type: Number, required: true, default: 0 },
    balanceAfter: { type: Number, required: true, default: 0 },
    referenceType: { type: String, enum: ['COMMERCIAL_INVOICE', 'MANUAL'], default: 'MANUAL' },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    narration: { type: String, required: true, trim: true, maxlength: 300 },
    entryDate: { type: Date, required: true, default: Date.now },
    recordedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'cnf_agent_ledgers',
  }
);

CnfAgentLedgerSchema.index({ orgId: 1, agentId: 1, createdAt: -1 });

export const CnfAgentLedger = mongoose.model<ICnfAgentLedger>('CnfAgentLedger', CnfAgentLedgerSchema);
