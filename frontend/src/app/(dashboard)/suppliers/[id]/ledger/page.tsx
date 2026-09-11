'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import { formatCurrency, formatDateTime } from '../../../../../lib/utils';
import {
  Building2,
  ArrowLeft,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/Button';
import { Badge } from '../../../../../components/ui/Badge';

interface LedgerEntry {
  _id: string;
  transactionType: 'BILL' | 'PAYMENT' | 'RETURN' | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId?: string;
  narration: string;
  createdAt: string;
}

export default function SupplierLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // Fetch supplier profile
  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ['supplier-detail', id],
    queryFn: async () => {
      const res = await api.get(`/suppliers/${id}`);
      return res.data;
    },
  });

  // Fetch ledger entries
  const {
    data: ledgerEntries = [],
    isLoading: loadingLedger,
    refetch,
    isRefetching,
  } = useQuery<LedgerEntry[]>({
    queryKey: ['supplier-ledger', id],
    queryFn: async () => {
      const res = await api.get(`/suppliers/${id}/ledger`);
      return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
    },
  });

  const totalBilled = ledgerEntries
    .filter((e) => e.transactionType === 'BILL')
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalPaid = ledgerEntries
    .filter((e) => e.transactionType === 'PAYMENT')
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <Link href="/suppliers">
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to suppliers"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {supplier?.companyName || 'Supplier'} — Vendor Ledger
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Contact: {supplier?.contactPerson || 'Rep'} · Phone: {supplier?.phone || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Billed (Procurement)
          </span>
          <p className="text-xl font-bold text-white mt-1.5">{formatCurrency(totalBilled)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Sum of all goods received invoices</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Disbursed Payments
          </span>
          <p className="text-xl font-bold text-emerald-400 mt-1.5">{formatCurrency(totalPaid)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Cleared through Bank/Cash</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Outstanding Balance
          </span>
          <p
            className={`text-xl font-bold mt-1.5 ${
              (supplier?.currentPayableBalance ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {formatCurrency(supplier?.currentPayableBalance ?? 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Accounts payable obligation</p>
        </div>
      </div>

      {/* Ledger Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Transaction Entries</span>
          </h3>
          <span className="text-xs text-slate-400">{ledgerEntries.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Description / Reference</th>
                <th className="py-3.5 px-4 text-right">Debit (Paid)</th>
                <th className="py-3.5 px-4 text-right">Credit (Billed)</th>
                <th className="py-3.5 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingLedger ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-xs">Loading ledger entries...</p>
                  </td>
                </tr>
              ) : ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No ledger transactions yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Transactions will record here when PO bills or payments are processed.
                    </p>
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((e) => {
                  const isPayment = e.transactionType === 'PAYMENT';
                  return (
                    <tr key={e._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {formatDateTime(e.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={isPayment ? 'success' : 'danger'}
                          size="sm"
                        >
                          {e.transactionType}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white text-xs">{e.narration}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Ref: {e.referenceType}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-400">
                        {isPayment ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-rose-400">
                        {!isPayment ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {formatCurrency(e.balanceAfter)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
