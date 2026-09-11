import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter {
  _id: string; // e.g. "invoice_seq_20260907", "po_seq_2026"
  seq: number;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0, required: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
    collection: 'counters',
  }
);

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);
