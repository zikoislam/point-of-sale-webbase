import { ClientSession } from 'mongoose';
import { Counter } from '../models/Counter';
import { currentOrgId } from '../middlewares/org.context';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Sequence counters are per organization: inside a request scope the key is
 * prefixed with the active org id, so two organizations can never collide on
 * an invoice / PO / journal number.
 */
function scopedKey(key: string): string {
  const orgId = currentOrgId();
  return orgId ? `${orgId}_${key}` : key;
}

export async function nextSequence(key: string, session?: ClientSession): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: scopedKey(key) },
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

/** Journal voucher number, e.g. JV-20260907-00001. */
export async function generateJournalNo(session?: ClientSession): Promise<string> {
  const day = todayKey();
  const seq = await nextSequence(`journal_seq_${day}`, session);
  return `JV-${day}-${String(seq).padStart(5, '0')}`;
}

/** SR field order number, e.g. SRO-20260927-00001. */
export async function generateSrOrderNo(session?: ClientSession): Promise<string> {
  const day = todayKey();
  const seq = await nextSequence(`sro_seq_${day}`, session);
  return `SRO-${day}-${String(seq).padStart(5, '0')}`;
}

/** Purchase return (debit note) number, e.g. PR-2026-00001. */
export async function generatePurchaseReturnNo(session?: ClientSession): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`purchase_return_seq_${year}`, session);
  return `PR-${year}-${String(seq).padStart(4, '0')}`;
}

/** Branch stock transfer number, e.g. ST-2026-00001. */
export async function generateStockTransferNo(session?: ClientSession): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`stock_transfer_seq_${year}`, session);
  return `ST-${year}-${String(seq).padStart(4, '0')}`;
}

/** Letter of credit number, e.g. LC-2026-0001. */
export async function generateLcNumber(session?: ClientSession): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`lc_seq_${year}`, session);
  return `LC-${year}-${String(seq).padStart(4, '0')}`;
}

/** Proforma invoice number, e.g. PI-2026-0001. */
export async function generatePiNumber(session?: ClientSession): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`pi_seq_${year}`, session);
  return `PI-${year}-${String(seq).padStart(4, '0')}`;
}

/** Commercial invoice number, e.g. CI-2026-0001. */
export async function generateCiNumber(session?: ClientSession): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`ci_seq_${year}`, session);
  return `CI-${year}-${String(seq).padStart(4, '0')}`;
}
