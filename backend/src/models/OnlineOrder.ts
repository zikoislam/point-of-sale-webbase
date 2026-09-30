import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOnlineOrderItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  variantSku: string; // snapshot
  productName: string; // snapshot
  variantName: string; // snapshot
  quantity: number;
  unitPrice: number; // retail price at order time
}

export interface ICourierInfo {
  provider: 'PATHAO' | 'REDX' | 'MANUAL';
  consignmentId?: string;
  trackingCode?: string;
  status: 'PENDING' | 'PICKED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED' | 'CANCELLED' | 'FAILED';
  deliveryFee: number;
  codAmount: number;
  weightKg?: number;
  note?: string;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  lastSyncAt?: Date | null;
}

export interface ICourierEvent {
  at: Date;
  status: string;
  source: 'API' | 'WEBHOOK' | 'MANUAL';
  note?: string;
}

export interface IOnlineOrder extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  orderNo: string; // e.g. WEB-000001
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  items: IOnlineOrderItem[];
  totalAmount: number;
  paymentMethod: 'COD';
  paymentStatus: 'UNPAID' | 'PAID';
  fulfillmentStatus: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  saleId?: Types.ObjectId | null; // Ref: sales — set when confirmed
  customerId?: Types.ObjectId | null; // Ref: customers — linked on confirm
  trackingCode?: string; // courier tracking, later
  /** Courier / delivery integration (Module 10). */
  courier?: ICourierInfo | null;
  courierHistory?: ICourierEvent[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OnlineOrderItemSchema = new Schema<IOnlineOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    variantSku: { type: String, trim: true },
    productName: { type: String, trim: true },
    variantName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OnlineOrderSchema = new Schema<IOnlineOrder>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    orderNo: { type: String, required: true, trim: true },
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      phone: { type: String, required: true, trim: true, maxlength: 30 },
      address: { type: String, required: true, trim: true, maxlength: 500 },
    },
    items: {
      type: [OnlineOrderItemSchema],
      required: true,
      validate: [(v: IOnlineOrderItem[]) => v.length > 0, 'Order needs at least one item'],
    },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ['COD'], default: 'COD', required: true },
    paymentStatus: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID', required: true },
    fulfillmentStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    trackingCode: { type: String, trim: true },
    courier: {
      type: new Schema<ICourierInfo>(
        {
          provider: { type: String, enum: ['PATHAO', 'REDX', 'MANUAL'], required: true },
          consignmentId: { type: String, trim: true },
          trackingCode: { type: String, trim: true },
          status: {
            type: String,
            enum: ['PENDING', 'PICKED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'],
            default: 'PENDING',
            required: true,
          },
          deliveryFee: { type: Number, min: 0, default: 0 },
          codAmount: { type: Number, min: 0, default: 0 },
          weightKg: { type: Number, min: 0 },
          note: { type: String, trim: true, maxlength: 300 },
          sentAt: { type: Date, default: null },
          deliveredAt: { type: Date, default: null },
          lastSyncAt: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    courierHistory: {
      type: [
        new Schema<ICourierEvent>(
          {
            at: { type: Date, default: Date.now },
            status: { type: String, required: true },
            source: { type: String, enum: ['API', 'WEBHOOK', 'MANUAL'], required: true },
            note: { type: String, trim: true, maxlength: 300 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false, collection: 'online_orders' }
);

OnlineOrderSchema.index({ orgId: 1, orderNo: 1 }, { unique: true });
// Courier lookups (webhook resolves an order from the consignment / tracking id)
OnlineOrderSchema.index({ 'courier.consignmentId': 1 });
OnlineOrderSchema.index({ 'courier.trackingCode': 1 });

export const OnlineOrder = mongoose.model<IOnlineOrder>('OnlineOrder', OnlineOrderSchema);
