'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  RotateCcw,
  Printer,
  Calendar,
  DollarSign,
  User,
  Layers,
  ArrowRight,
  Check,
  X,
  RefreshCw,
  Ticket,
  AlertTriangle,
  FileText,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  'Content-Type': 'application/json',
});
const fetchOpts = (opts: RequestInit = {}): RequestInit => ({
  ...opts,
  credentials: 'include' as RequestCredentials,
  headers: { ...authHeader(), ...(opts.headers as Record<string, string> || {}) },
});

interface SaleItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitSellingPrice: number;
  discount: number;
  lineTotal: number;
}

interface SaleRecord {
  _id: string;
  invoiceNo: string;
  createdAt: string;
  cashierId?: { name: string };
  customerId?: { name: string; phone: string };
  pricingTier: string;
  items: SaleItem[];
  subtotal: number;
  totalTax: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeReturned: number;
  dueAmount: number;
  payments: { method: string; amount: number }[];
}

interface ReturnRecord {
  _id: string;
  returnNo: string;
  originalInvoiceNo: string;
  customerId?: { name: string; phone: string };
  authorizedById?: { name: string };
  totalRefundAmount: number;
  refundType: string;
  voucherId?: { voucherCode: string };
  reason: string;
  createdAt: string;
}

export default function SalesHistoryPage() {
  const [activeTab, setActiveTab] = useState<'SALES' | 'RETURNS'>('SALES');
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Return Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState<
    {
      variantId: string;
      productName: string;
      soldQty: number;
      returnQty: number;
      unitRefundPrice: number;
      isResaleable: boolean;
    }[]
  >([]);
  const [refundType, setRefundType] = useState<'CASH' | 'STORE_CREDIT'>('CASH');
  const [returnReason, setReturnReason] = useState('');
  const [returnManagerPin, setReturnManagerPin] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [completedReturn, setCompletedReturn] = useState<any>(null);

  const fetchSales = useCallback(async () => {
    try {
      // Fetch recent sales via invoices or reports
      const res = await fetch(`${API}/sales?limit=50`, fetchOpts()).catch(() => null);
      if (res && res.ok) {
        const j = await res.json();
        if (j.success) setSales(j.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchReturns = useCallback(async () => {
    try {
      const res = await fetch(`${API}/returns?limit=50`, fetchOpts());
      const j = await res.json();
      if (j.success) setReturns(j.data.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSales(), fetchReturns()]);
    setLoading(false);
  }, [fetchSales, fetchReturns]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Invoice Lookup by Search
  const handleSearchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/sales/${search.trim()}`, fetchOpts());
      const j = await res.json();
      if (j.success && j.data) {
        setSales([j.data]);
      } else {
        alert(j.message || 'Invoice not found');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openReturnModal = (sale: SaleRecord) => {
    setSelectedSale(sale);
    setReturnReason('Customer requested return');
    setRefundType(sale.customerId ? 'STORE_CREDIT' : 'CASH');
    setReturnError('');
    setCompletedReturn(null);

    setReturnItems(
      sale.items.map((i) => ({
        variantId: i.variantId,
        productName: `${i.productName} (${i.variantName})`,
        soldQty: i.quantity,
        returnQty: 0,
        unitRefundPrice: i.unitSellingPrice,
        isResaleable: true,
      }))
    );

    setShowReturnModal(true);
  };

  const handleProcessReturn = async () => {
    if (!selectedSale) return;
    const activeReturns = returnItems.filter((i) => i.returnQty > 0);
    if (activeReturns.length === 0) {
      setReturnError('Please enter return quantity > 0 for at least one item');
      return;
    }
    if (!returnReason.trim()) {
      setReturnError('Please enter a reason for the return');
      return;
    }
    if (!/^\d{4,}$/.test(returnManagerPin.trim())) {
      setReturnError('Manager PIN (min 4 digits) is required to authorise a return');
      return;
    }

    setReturnSaving(true);
    setReturnError('');

    try {
      const payload = {
        saleId: selectedSale._id,
        refundType,
        reason: returnReason.trim(),
        items: activeReturns.map((i) => ({
          variantId: i.variantId,
          quantity: Number(i.returnQty),
          unitRefundPrice: Number(i.unitRefundPrice),
          isResaleable: i.isResaleable,
        })),
        managerPin: returnManagerPin.trim(),
      };

      const res = await fetch(`${API}/returns`, fetchOpts({
        method: 'POST',
        body: JSON.stringify(payload),
      }));

      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message || j.message || 'Failed to process return');

      setCompletedReturn(j.data);
      refreshAll();
    } catch (e: any) {
      setReturnError(e.message);
    } finally {
      setReturnSaving(false);
    }
  };

  const totalRefundAmount = returnItems.reduce(
    (acc, i) => acc + (Number(i.returnQty) || 0) * (Number(i.unitRefundPrice) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sales History & Returns</h1>
            <p className="text-sm text-slate-400">
              Audit customer invoices, process item returns & issue store credit vouchers
            </p>
          </div>
        </div>

        <button
          onClick={refreshAll}
          className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('SALES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'SALES'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Completed Sales</span>
        </button>
        <button
          onClick={() => setActiveTab('RETURNS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'RETURNS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Processed Returns ({returns.length})</span>
        </button>
      </div>

      {/* Search Toolbar */}
      {activeTab === 'SALES' && (
        <form onSubmit={handleSearchInvoice} className="flex items-center max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice number (e.g. INV-2026...)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="ml-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white transition"
          >
            Find
          </button>
        </form>
      )}

      {/* Tab 1: Sales History */}
      {activeTab === 'SALES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-center">Items</th>
                  <th className="py-3.5 px-4 text-right">Net Total</th>
                  <th className="py-3.5 px-4 text-right">Paid / Due</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                      Loading sales records...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No sales found. Process a sale on the POS Terminal to view records here.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <Link
                          href={`/sales/${s._id}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline transition"
                        >
                          {s.invoiceNo}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">
                          {s.customerId?.name || 'Walk-in Customer'}
                        </div>
                        {s.customerId?.phone && (
                          <div className="text-xs text-slate-400">{s.customerId.phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {s.items?.length || 0} items
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-400">
                        ৳{s.totalAmount?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs">
                        <div className="text-emerald-400">Paid: ৳{s.paidAmount?.toFixed(2)}</div>
                        {s.dueAmount > 0 && (
                          <div className="text-rose-400 font-bold">
                            Due: ৳{s.dueAmount.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedSale(s);
                              setShowReceiptModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Print Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReturnModal(s)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-600/30 transition flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Return</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Processed Returns */}
      {activeTab === 'RETURNS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4">Return #</th>
                  <th className="py-3.5 px-4">Original Invoice</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-right">Refund Amount</th>
                  <th className="py-3.5 px-4 text-center">Refund Type</th>
                  <th className="py-3.5 px-4">Voucher / Ref</th>
                  <th className="py-3.5 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No returns recorded yet.
                    </td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-rose-400">{r.returnNo}</td>
                      <td className="py-3.5 px-4 text-white font-medium">{r.originalInvoiceNo}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {r.customerId?.name || 'Walk-in'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-rose-400">
                        ৳{r.totalRefundAmount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {r.refundType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-amber-400">
                        {r.voucherId?.voucherCode || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {r.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process Return Modal */}
      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Process Item Return & Refund</h2>
                <p className="text-xs text-slate-400">Original Invoice #{selectedSale.invoiceNo}</p>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {completedReturn ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Return Processed Successfully!</h3>
                <p className="text-xs text-slate-400">
                  Return Reference: <span className="text-rose-400 font-bold">{completedReturn.returnNo}</span>
                </p>

                {completedReturn.voucherId && (
                  <div className="p-4 bg-slate-950 border border-amber-500/40 rounded-2xl text-center space-y-2">
                    <div className="text-xs text-amber-400 uppercase font-semibold">
                      Store Credit Voucher Issued
                    </div>
                    <div className="text-2xl font-mono font-black text-amber-300">
                      {completedReturn.voucherId?.voucherCode || 'CR-VOUCHER'}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Customer can present this voucher code during future checkouts.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowReturnModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
                {returnError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                    {returnError}
                  </div>
                )}

                {/* Items Checklist */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300 uppercase">
                    Select Items to Return
                  </label>
                  {returnItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{item.productName}</span>
                        <span className="text-slate-400">Purchased Qty: {item.soldQty}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Return Qty (Max {item.soldQty})
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.returnQty}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                              const updated = [...returnItems];
                              const val = Math.min(item.soldQty, Math.max(0, Number(raw)));
                              updated[idx].returnQty = val;
                              setReturnItems(updated);
                            }}
                            min={0}
                            max={item.soldQty}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Refund Unit Price (৳)</label>
                          <input
                            type="number"
                            value={item.unitRefundPrice}
                            readOnly
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Item Condition</label>
                          <select
                            value={item.isResaleable ? 'YES' : 'NO'}
                            onChange={(e) => {
                              const updated = [...returnItems];
                              updated[idx].isResaleable = e.target.value === 'YES';
                              setReturnItems(updated);
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                          >
                            <option value="YES">Resaleable (Restock)</option>
                            <option value="NO">Damaged (Wastage)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Refund Method & Reason */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Refund Disbursement
                    </label>
                    <select
                      value={refundType}
                      onChange={(e) => setRefundType(e.target.value as any)}
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                    >
                      <option value="CASH">Cash Refund (Deduct Drawer)</option>
                      <option value="STORE_CREDIT">Store Credit Voucher</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Manager PIN *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={returnManagerPin}
                      onChange={(e) => setReturnManagerPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono tracking-widest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Reason for Return *
                    </label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. Defective, wrong size, expired"
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Refund Disbursement:</span>
                  <span className="text-xl font-black text-rose-400">
                    ৳{totalRefundAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowReturnModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessReturn}
                    disabled={returnSaving || totalRefundAmount <= 0}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20"
                  >
                    {returnSaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Authorize Return</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Print Modal */}
      {showReceiptModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print-sale-memo">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl font-mono text-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100 print:hidden">
              <span className="font-bold text-slate-700">INVOICE PREVIEW</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs flex items-center space-x-1"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h1 className="text-base font-black tracking-tight">POINT OF SALE STORE</h1>
                <p className="text-[10px] text-slate-600 mt-0.5">Invoice: {selectedSale.invoiceNo}</p>
                <div className="text-[10px] text-slate-500">
                  {new Date(selectedSale.createdAt).toLocaleString()}
                </div>
                {selectedSale.customerId && (
                  <div className="text-[10px] text-slate-500 mt-1">
                    Customer: {selectedSale.customerId.name} ({selectedSale.customerId.phone})
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {selectedSale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <div>
                      <div>{item.productName}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.quantity} x ৳{item.unitSellingPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold">৳{item.lineTotal.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>৳{selectedSale.subtotal.toFixed(2)}</span>
                </div>
                {selectedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-৳{selectedSale.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>Grand Total:</span>
                  <span>৳{selectedSale.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid:</span>
                  <span>৳{selectedSale.paidAmount.toFixed(2)}</span>
                </div>
                {selectedSale.dueAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Due Balance:</span>
                    <span>৳{selectedSale.dueAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2">
                Return Policy: 7 days with original receipt.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
