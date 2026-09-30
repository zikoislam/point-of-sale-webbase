import mongoose, { Document, Schema, Types } from 'mongoose';

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export interface ITicketResponse {
  at: Date;
  by: Types.ObjectId;
  byName?: string;
  /** true when the reply went to the customer (starts the SLA clock). */
  isCustomerVisible: boolean;
  message: string;
}

/** A customer complaint / support request with an SLA clock (Module 8). */
export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  ticketNo: string; // TKT-2026-0001
  subject: string;
  description: string;
  category?: string;
  customerId?: Types.ObjectId | null;
  customerName?: string;
  customerPhone?: string;
  relatedOrderNo?: string;
  priority: (typeof TICKET_PRIORITIES)[number];
  status: (typeof TICKET_STATUSES)[number];
  assigneeId?: Types.ObjectId | null;
  /** SLA hours allowed for the first response (from the priority). */
  slaHours: number;
  /** When the first response is due. */
  slaDueAt: Date;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  resolution?: string;
  satisfactionRating?: number | null;
  responses: ITicketResponse[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TicketResponseSchema = new Schema<ITicketResponse>(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    byName: { type: String, trim: true },
    isCustomerVisible: { type: Boolean, default: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    ticketNo: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    category: { type: String, trim: true, maxlength: 80 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, trim: true, maxlength: 160 },
    customerPhone: { type: String, trim: true, maxlength: 30 },
    relatedOrderNo: { type: String, trim: true, maxlength: 60 },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'NORMAL', required: true, index: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'OPEN', required: true, index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    slaHours: { type: Number, required: true, min: 1, default: 24 },
    slaDueAt: { type: Date, required: true, index: true },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolution: { type: String, trim: true, maxlength: 2000 },
    satisfactionRating: { type: Number, min: 1, max: 5, default: null },
    responses: { type: [TicketResponseSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'support_tickets' }
);

SupportTicketSchema.index({ orgId: 1, ticketNo: 1 }, { unique: true });
SupportTicketSchema.index({ orgId: 1, status: 1, slaDueAt: 1 });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
