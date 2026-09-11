import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISupplierLedger extends Document {
  _id: Types.ObjectId;
  supplierId: Types.ObjectId; // Ref: suppliers
  transactionType: 'PO_GRN_BILL' | 'PAYMENT_DISBURSAL' | 'PURCHASE_RETURN';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'PO' | 'DISBURSEMENT';
  referenceId: Types.ObjectId;
  narration: string;
  recordedById: Types.ObjectId; // Ref: users
  createdAt: Date;
}

const SupplierLedgerSchema = new Schema<ISupplierLedger>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    transactionType: {
      type: String,
      enum: ['PO_GRN_BILL', 'PAYMENT_DISBURSAL', 'PURCHASE_RETURN'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['PO', 'DISBURSEMENT'],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    narration: {
      type: String,
      required: true,
      trim: true,
    },
    recordedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'supplier_ledgers',
  }
);

// Indexes
SupplierLedgerSchema.index({ supplierId: 1, createdAt: -1 });

export const SupplierLedger = mongoose.model<ISupplierLedger>('SupplierLedger', SupplierLedgerSchema);
