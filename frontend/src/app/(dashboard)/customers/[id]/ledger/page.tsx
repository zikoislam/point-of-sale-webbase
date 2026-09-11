'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import { formatCurrency, formatDateTime } from '../../../../../lib/utils';
import {
  Users,
  ArrowLeft,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/Button';
import { Badge } from '../../../../../components/ui/Badge';

interface LedgerEntry {
  _id: string;
  transactionType: 'SALE_DUE' | 'PAYMENT' | 'RETURN_CREDIT' | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId?: string;
  narration: string;
  createdAt: string;
}

export default function CustomerLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // Fetch customer profile
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`);
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
    queryKey: ['customer-ledger', id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}/ledger`);
      return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
    },
  });

  const totalDueAdded = ledgerEntries
    .filter((e) => e.transactionType === 'SALE_DUE')
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalPaid = ledgerEntries
    .filter((e) => e.transactionType === 'PAYMENT' || e.transactionType === 'RETURN_CREDIT')
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const creditLimit = customer?.creditLimit || 0;
  const currentDue = customer?.currentDueBalance || 0;
  const isHighDue = creditLimit > 0 && currentDue >= creditLimit * 0.9;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <Link href="/customers">
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to customers"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {customer?.name || 'Customer'} — Bakir Khata Ledger
              </h1>
              {customer?.customerType && (
                <Badge variant={customer.customerType === 'WHOLESALE' ? 'purple' : 'info'}>
                  {customer.customerType}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" />
              <span>Phone: {customer?.phone || 'N/A'}</span>
              {customer?.email && <span>· Email: {customer.email}</span>}
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

      {/* High Due Warning Alert */}
      {isHighDue && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="font-semibold">Credit Limit Warning</p>
            <p className="text-xs text-rose-400/80">
              Customer due balance is at or exceeding 90% of credit limit (৳{creditLimit.toLocaleString()}).
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credit Limit</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {formatCurrency(creditLimit)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Due Generated</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">
            {formatCurrency(totalDueAdded)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Repaid</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            {formatCurrency(totalPaid)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Outstanding</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">
            {formatCurrency(currentDue)}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Transaction History (Bakir Khata)
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {ledgerEntries.length} Record{ledgerEntries.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingLedger ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Loading customer ledger...
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No ledger entries found for this customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Narration / Ref</th>
                  <th className="px-6 py-3.5 text-right">Debit (Due)</th>
                  <th className="px-6 py-3.5 text-right">Credit (Paid)</th>
                  <th className="px-6 py-3.5 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {ledgerEntries.map((e) => {
                  const isDebit = e.transactionType === 'SALE_DUE';
                  return (
                    <tr key={e._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {formatDateTime(e.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={isDebit ? 'danger' : 'success'}>
                          {e.transactionType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{e.narration || '-'}</p>
                        {e.referenceType && (
                          <p className="text-xs text-slate-500 font-mono">
                            Ref: {e.referenceType}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-rose-400">
                        {isDebit ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-400">
                        {!isDebit ? formatCurrency(e.amount) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-amber-300">
                        {formatCurrency(e.balanceAfter)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
