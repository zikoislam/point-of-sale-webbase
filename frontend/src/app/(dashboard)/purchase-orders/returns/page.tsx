'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Undo2,
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  Printer,
  FileText,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { useToast } from '../../../../components/ui/Toast';
import { useBranding } from '../../../../hooks/useBranding';

interface PoItem {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
}

interface PO {
  _id: string;
  id?: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  supplierId?: any;
  items?: PoItem[];
}

interface ReturnRow {
  _id: string;
  returnNumber: string;
  totalAmount: number;
  status: string;
  refundMethod: string;
  createdAt: string;
  supplierId?: any;
  purchaseOrderId?: any;
  items?: any[];
}

const refundMethods = [
  { value: 'ADJUSTED_AGAINST_PAYABLE', label: 'Adjust against payable (debit note)' },
  { value: 'CASH', label: 'Cash refund' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CREDIT_NOTE', label: 'Credit note for future purchase' },
];

const money = (v: number) => `৳${(v || 0).toFixed(2)}`;

const REASONS = ['Damaged', 'Expired', 'Wrong item', 'Quality issue', 'Over-delivered', 'Other'];

export default function PurchaseReturnsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branding = useBranding();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);
  const [returns, setReturns] = useState<Record<string, { qty: string; reason: string; note: string }>>({});
  const [refundMethod, setRefundMethod] = useState('ADJUSTED_AGAINST_PAYABLE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [debitNote, setDebitNote] = useState<ReturnRow | null>(null);

  const { data: pos = [], isLoading: posLoading, refetch: refetchPos } = useQuery<PO[]>({
    queryKey: ['purchase-returns-pos'],
    queryFn: async () => {
      const res = await api.get('/purchase-orders?limit=100');
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
      return rows.filter((p: any) => p.status === 'RECEIVED' || p.status === 'PARTIAL');
    },
  });

  const { data: existingReturns = [], refetch: refetchReturns } = useQuery<ReturnRow[]>({
    queryKey: ['purchase-returns-list'],
    queryFn: async () => {
      const res = await api.get('/purchase-returns?limit=50');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  // Full PO (with items) when moving to step 2
  const { data: poDetail } = useQuery<PO>({
    queryKey: ['purchase-return-po-detail', selectedPo?._id],
    queryFn: async () => {
      const res = await api.get(`/purchase-orders/${selectedPo!._id}`);
      return res.data;
    },
    enabled: !!selectedPo && step === 2,
  });

  useEffect(() => {
    if (poDetail?.items && Object.keys(returns).length === 0) {
      const seed: Record<string, { qty: string; reason: string; note: string }> = {};
      for (const item of poDetail.items) {
        seed[item.variantId] = { qty: '', reason: 'Damaged', note: '' };
      }
      setReturns(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poDetail]);

  const filteredPos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pos;
    return pos.filter(
      (p) => p.poNumber.toLowerCase().includes(q) || (p.supplierId?.companyName || '').toLowerCase().includes(q)
    );
  }, [pos, search]);

  const itemsToReturn = useMemo(() => {
    if (!poDetail?.items) return [];
    return poDetail.items
      .map((item) => ({
        item,
        entry: returns[item.variantId] || { qty: '', reason: '', note: '' },
      }))
      .filter(({ entry }) => Number(entry.qty) > 0);
  }, [poDetail, returns]);

  const totalReturn = itemsToReturn.reduce(
    (n, { item, entry }) => n + Number(entry.qty) * (item.unitCost || 0),
    0
  );

  const submitReturn = async () => {
    if (!selectedPo || itemsToReturn.length === 0) {
      toast.error('Select at least one item and quantity');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/purchase-returns', {
        purchaseOrderId: selectedPo._id,
        refundMethod,
        notes: notes || undefined,
        items: itemsToReturn.map(({ item, entry }) => ({
          variantId: item.variantId,
          quantity: Number(entry.qty),
          unitCost: item.unitCost,
          reason: entry.note?.trim() ? `${entry.reason} — ${entry.note.trim()}` : entry.reason,
        })),
      });
      toast.success('Debit note created — stock and payable updated');
      setDebitNote(res.data);
      queryClient.invalidateQueries({ queryKey: ['purchase-returns-list'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-returns-pos'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (id: string, status: 'CONFIRMED' | 'REFUNDED') => {
    try {
      await api.put(`/purchase-returns/${id}/status`, { status });
      toast.success(`Return marked ${status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['purchase-returns-list'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedPo(null);
    setReturns({});
    setNotes('');
    setRefundMethod('ADJUSTED_AGAINST_PAYABLE');
    setDebitNote(null);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Undo2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Purchase Returns (Debit Note)</h1>
            <p className="text-sm text-slate-400">
              Send goods back to a supplier — stock, payable and the books update automatically
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/purchase-orders"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Purchase Orders
          </Link>
          <Button variant="outline" size="sm" leftIcon={<RefreshCw />} onClick={() => { refetchPos(); refetchReturns(); }}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 p-3 rounded-xl print:hidden">
        {[
          { n: 1, label: 'Select PO' },
          { n: 2, label: 'Items & reason' },
          { n: 3, label: 'Refund method' },
        ].map((s) => (
          <React.Fragment key={s.n}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${step === s.n ? 'bg-rose-600 text-white' : step > s.n ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center">{step > s.n ? <Check className="w-3 h-3" /> : s.n}</span>
              {s.label}
            </div>
            {s.n < 3 && <ArrowRight className="w-4 h-4 text-slate-600" />}
          </React.Fragment>
        ))}
        <span className="ml-auto">
          <Button variant="ghost" size="sm" onClick={resetWizard}>Start over</Button>
        </span>
      </div>

      {/* ── Step 1 — pick the PO ── */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg print:hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Received purchase orders</span>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="PO number or supplier…"
                className="w-64 pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">PO #</th>
                  <th className="px-5 py-3 text-left">Supplier</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {posLoading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Loading purchase orders…</td></tr>
                ) : filteredPos.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No received purchase orders to return against.</td></tr>
                ) : (
                  filteredPos.map((po) => (
                    <tr key={po._id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3.5 font-bold text-white">{po.poNumber}</td>
                      <td className="px-5 py-3.5 text-slate-300">{po.supplierId?.companyName || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-400">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5"><Badge variant={po.status === 'RECEIVED' ? 'success' : 'warning'} size="sm">{po.status}</Badge></td>
                      <td className="px-5 py-3.5 text-right text-slate-300">{money(po.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedPo(po);
                            setReturns({});
                            setStep(2);
                          }}
                        >
                          Select
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Step 2 — items & reasons ── */}
      {step === 2 && selectedPo && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg print:hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">{selectedPo.poNumber}</p>
              <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                {selectedPo.supplierId?.companyName || '—'}
              </p>
            </div>
            <span className="text-xs text-slate-400">Return total: <strong className="text-white">{money(totalReturn)}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-center">Return Qty</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(poDetail?.items || []).map((item) => {
                  const entry = returns[item.variantId] || { qty: '', reason: 'Damaged', note: '' };
                  const lineTotal = Number(entry.qty || 0) * (item.unitCost || 0);
                  return (
                    <tr key={item.variantId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-200">{item.productName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.sku}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{item.receivedQty}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{money(item.unitCost)}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={item.receivedQty}
                          value={entry.qty}
                          onChange={(e) =>
                            setReturns((prev) => ({
                              ...prev,
                              [item.variantId]: { ...entry, qty: e.target.value },
                            }))
                          }
                          placeholder="0"
                          className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white text-center focus:outline-none focus:border-rose-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={entry.reason}
                            onChange={(e) => setReturns((prev) => ({ ...prev, [item.variantId]: { ...entry, reason: e.target.value } }))}
                            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                          >
                            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <input
                            value={entry.note}
                            onChange={(e) => setReturns((prev) => ({ ...prev, [item.variantId]: { ...entry, note: e.target.value } }))}
                            placeholder="Note (optional)"
                            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">{money(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" size="sm" onClick={() => setStep(3)} disabled={itemsToReturn.length === 0}>
              Continue ({itemsToReturn.length} item{itemsToReturn.length === 1 ? '' : 's'})
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3 — refund method + submit ── */}
      {step === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 print:hidden">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Refund method</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {refundMethods.map((m) => (
                <label
                  key={m.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                    refundMethod === m.value
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    className="accent-rose-500"
                    checked={refundMethod === m.value}
                    onChange={() => setRefundMethod(m.value)}
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note printed on the debit note"
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Review */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Return summary</p>
            <div className="space-y-1.5">
              {itemsToReturn.map(({ item, entry }) => (
                <div key={item.variantId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {item.productName} × {entry.qty}
                    <span className="text-slate-500 text-xs"> · {entry.reason}</span>
                  </span>
                  <span className="text-slate-200">{money(Number(entry.qty) * item.unitCost)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
              <span className="text-sm font-bold text-white">Total debit note</span>
              <span className="text-lg font-black text-rose-300">{money(totalReturn)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setStep(2)}>
              Back
            </Button>
            <Button variant="primary" loading={submitting} onClick={submitReturn}>
              Confirm Return & Generate Debit Note
            </Button>
          </div>
        </div>
      )}

      {/* ── Debit note result (printable) ── */}
      {debitNote && (
        <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-2xl max-w-3xl mx-auto">
          <div className="flex items-start justify-between border-b border-slate-300 pb-4">
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide">Debit Note</h2>
              <p className="text-sm text-slate-600">{branding.shopName}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold">{debitNote.returnNumber}</p>
              <p className="text-slate-600">{new Date(debitNote.createdAt).toLocaleDateString()}</p>
              <p className="text-slate-600">Against PO {debitNote.purchaseOrderId?.poNumber || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Supplier</p>
              <p className="font-semibold">{debitNote.supplierId?.companyName || '—'}</p>
              <p className="text-slate-600">{debitNote.supplierId?.phone || ''}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Refund method</p>
              <p className="font-semibold">{debitNote.refundMethod.replace(/_/g, ' ')}</p>
              <p className="text-slate-600">Status: {debitNote.status}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y border-slate-300 text-left text-[11px] uppercase text-slate-500">
                <th className="py-2">Item</th>
                <th className="py-2">SKU</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit cost</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(debitNote.items || []).map((item: any, i: number) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-2">{item.productName}{item.variantName ? ` (${item.variantName})` : ''}</td>
                  <td className="py-2 font-mono text-xs">{item.sku}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{money(item.unitCost)}</td>
                  <td className="py-2 text-right font-semibold">{money(item.totalCost)}</td>
                  <td className="py-2 text-xs">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-xl font-black">{money(debitNote.totalAmount)}</p>
            </div>
          </div>

          {notes && <p className="mt-4 text-sm text-slate-600">Note: {notes}</p>}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-300 print:hidden">
            <Button variant="ghost" onClick={resetWizard}>New return</Button>
            <Button variant="primary" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
              Print Debit Note
            </Button>
          </div>
        </div>
      )}

      {/* ── Recent returns ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg print:hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <span className="text-xs text-slate-400">Recent purchase returns</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Debit note</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Supplier</th>
                <th className="px-5 py-3 text-left">PO</th>
                <th className="px-5 py-3 text-left">Refund</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {existingReturns.map((ret) => (
                <tr key={ret._id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3.5 font-bold text-white">{ret.returnNumber}</td>
                  <td className="px-5 py-3.5 text-slate-400">{new Date(ret.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-slate-300">{ret.supplierId?.companyName || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-400">{ret.purchaseOrderId?.poNumber || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{ret.refundMethod.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={ret.status === 'REFUNDED' ? 'success' : ret.status === 'DRAFT' ? 'info' : 'warning'} size="sm">
                      {ret.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-white">{money(ret.totalAmount)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {ret.status === 'DRAFT' && (
                      <Button variant="success" size="sm" onClick={() => setStatus(ret._id, 'CONFIRMED')}>Confirm</Button>
                    )}
                    {ret.status === 'CONFIRMED' && (
                      <Button variant="outline" size="sm" onClick={() => setStatus(ret._id, 'REFUNDED')}>Mark refunded</Button>
                    )}
                  </td>
                </tr>
              ))}
              {existingReturns.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">No purchase returns yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
