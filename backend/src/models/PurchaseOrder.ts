import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPOItem {
  variantId: Types.ObjectId;
  productName: string; // Snapshot
  sku: string; // Snapshot
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
}

export interface IPurchaseOrder extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Branch that raised the order (multi-branch chains). */
  branchId?: Types.ObjectId | null;
  /** Project this purchase belongs to, when the order is job-based. */
  projectId?: Types.ObjectId | null;
  poNumber: string; // Unique per org, e.g. "PO-20260907-0001"
  supplierId: Types.ObjectId; // Ref: suppliers
  status: 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  /** Approval workflow — big purchase orders wait for a manager. */
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
  approvedBy?: Types.ObjectId | null; // Ref: users
  approvedAt?: Date | null;
  rejectionReason?: string;
  requestedBy?: Types.ObjectId | null; // Ref: users (who raised the PO)
  items: IPOItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  expectedDeliveryDate?: Date;
  actualReceivedDate?: Date;
  vendorInvoiceNo?: string;
  createdById: Types.ObjectId; // Ref: users
  receivedById?: Types.ObjectId; // Ref: users
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const POItemSchema = new Schema<IPOItem>(
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
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: 0.01,
    },
    receivedQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    poNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'AUTO_APPROVED'],
      default: 'AUTO_APPROVED',
      required: true,
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 300 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    items: {
      type: [POItemSchema],
      required: true,
      validate: [(val: IPOItem[]) => val.length > 0, 'PO must contain at least one item'],
    },
    subtotal: {
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
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
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
    expectedDeliveryDate: {
      type: Date,
    },
    actualReceivedDate: {
      type: Date,
    },
    vendorInvoiceNo: {
      type: String,
      trim: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receivedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'purchase_orders',
  }
);

// Indexes
PurchaseOrderSchema.index({ orgId: 1, poNumber: 1 }, { unique: true });
PurchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });
PurchaseOrderSchema.index({ status: 1 });
// Reporting / approval paths (Phase 12.1)
PurchaseOrderSchema.index({ orgId: 1, supplierId: 1, status: 1 });
PurchaseOrderSchema.index({ orgId: 1, approvalStatus: 1 });
PurchaseOrderSchema.index({ orgId: 1, createdAt: -1 });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
