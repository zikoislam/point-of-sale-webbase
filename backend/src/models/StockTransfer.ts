import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStockTransferItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string; // snapshot
  variantName: string; // snapshot
  sku: string; // snapshot
  quantity: number;
  unitCost: number;
  /** Quantity actually received at the destination (may be less). */
  receivedQty: number;
}

/** Stock moved from one branch to another (challan / transfer note). */
export interface IStockTransfer extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  transferNumber: string; // ST-YYYY-XXXX
  fromBranchId: Types.ObjectId; // Ref: branches
  toBranchId: Types.ObjectId; // Ref: branches
  items: IStockTransferItem[];
  totalValue: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  /**
   * A transfer is an *issue request* until a manager approves it. Approval
   * dispatches the goods, which is what makes them "incoming" for the
   * destination branch.
   */
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  requestedById?: Types.ObjectId | null; // Ref: users — who raised the request
  approvedById?: Types.ObjectId | null; // Ref: users — the manager
  approvedAt?: Date | null;
  rejectionReason?: string;
  sentBy?: Types.ObjectId | null; // Ref: users
  receivedBy?: Types.ObjectId | null; // Ref: users
  sentAt?: Date | null;
  receivedAt?: Date | null;
  notes?: string;
  createdBy: Types.ObjectId; // Ref: users
  createdAt: Date;
  updatedAt: Date;
}

const StockTransferItemSchema = new Schema<IStockTransferItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    variantName: { type: String, trim: true },
    sku: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitCost: { type: Number, required: true, min: 0, default: 0 },
    receivedQty: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const StockTransferSchema = new Schema<IStockTransfer>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    transferNumber: { type: String, required: true, trim: true },
    fromBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    toBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    items: {
      type: [StockTransferItemSchema],
      required: true,
      validate: [(v: IStockTransferItem[]) => v.length > 0, 'A transfer needs at least one item'],
    },
    totalValue: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      required: true,
      index: true,
    },
    requestedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sentAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'stock_transfers' }
);

StockTransferSchema.index({ orgId: 1, transferNumber: 1 }, { unique: true });
StockTransferSchema.index({ orgId: 1, status: 1, createdAt: -1 });
// Incoming board + approval queue
StockTransferSchema.index({ orgId: 1, toBranchId: 1, status: 1 });
StockTransferSchema.index({ orgId: 1, approvalStatus: 1, createdAt: -1 });

export const StockTransfer = mongoose.model<IStockTransfer>('StockTransfer', StockTransferSchema);
