import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISrOrderItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string; // snapshot
  variantName: string; // snapshot
  sku: string; // snapshot
  quantity: number;
  unitPrice: number; // agreed price at order time
}

/**
 * An order collected in the field by an SR. An admin confirms it, which
 * converts it into a Sale through SaleService.
 */
export interface ISrOrder extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  orderNo: string;
  repId: Types.ObjectId; // Ref: sales_reps
  customerId: Types.ObjectId; // Ref: customers (the dealer/shop)
  items: ISrOrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CONVERTED' | 'CANCELLED';
  saleId?: Types.ObjectId | null; // Ref: sales — set when converted
  confirmedById?: Types.ObjectId | null; // Ref: users
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SrOrderItemSchema = new Schema<ISrOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    variantName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SrOrderSchema = new Schema<ISrOrder>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    orderNo: { type: String, required: true, trim: true },
    repId: { type: Schema.Types.ObjectId, ref: 'SalesRep', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: {
      type: [SrOrderItemSchema],
      required: true,
      validate: [(v: ISrOrderItem[]) => v.length > 0, 'Order must contain at least one item'],
    },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CONVERTED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
    confirmedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'sr_orders' }
);

SrOrderSchema.index({ orgId: 1, orderNo: 1 }, { unique: true });

export const SrOrder = mongoose.model<ISrOrder>('SrOrder', SrOrderSchema);
