import { ClientSession } from 'mongoose';
import { Counter } from '../models/Counter';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export async function nextSequence(key: string, session?: ClientSession): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return counter!.seq;
}

export async function generateInvoiceNo(session?: ClientSession): Promise<string> {
  const day = todayKey();
  const seq = await nextSequence(`invoice_seq_${day}`, session);
  return `INV-${day}-${String(seq).padStart(5, '0')}`;
}

export async function generatePONumber(session?: ClientSession): Promise<string> {
  const day = todayKey();
  const seq = await nextSequence(`po_seq_${day}`, session);
  return `PO-${day}-${String(seq).padStart(4, '0')}`;
}

export async function generateReturnNo(session?: ClientSession): Promise<string> {
  const day = todayKey();
  const seq = await nextSequence(`return_seq_${day}`, session);
  return `RET-${day}-${String(seq).padStart(4, '0')}`;
}
