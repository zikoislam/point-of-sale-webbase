'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import { formatCurrency, formatDateTime } from '../../../../../lib/utils';
import {
  Landmark,
  ArrowLeft,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/Button';
import { Badge } from '../../../../../components/ui/Badge';

interface AccountTransaction {
  _id: string;
  type: 'CREDIT' | 'DEBIT' | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId?: string;
  description: string;
  createdAt: string;
}

export default function AccountLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // Fetch account profile
  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ['account-detail', id],
    queryFn: async () => {
      const res = await api.get(`/accounts/${id}`);
      return res.data;
    },
  });

  // Fetch transactions
  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    refetch,
    isRefetching,
  } = useQuery<AccountTransaction[]>({
    queryKey: ['account-ledger', id],
    queryFn: async () => {
      const res = await api.get(`/accounts/${id}/transactions`);
      return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
    },
  });

  const totalCredits = transactions
    .filter((t) => t.type === 'CREDIT')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalDebits = transactions
    .filter((t) => t.type === 'DEBIT')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <Link href="/accounts">
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to accounts"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {account?.name || 'Financial Account'} — Ledger
              </h1>
              {account?.accountType && (
                <Badge variant={account.accountType === 'BANK' ? 'info' : account.accountType === 'MFS' ? 'purple' : 'success'}>
                  {account.accountType}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Account No: {account?.accountNumber || 'N/A'} · Status: {account?.isActive ? 'Active' : 'Inactive'}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            {formatCurrency(account?.currentBalance || 0)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Credits (Inflow)</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            {formatCurrency(totalCredits)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Debits (Outflow)</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">
            {formatCurrency(totalDebits)}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-400" />
            Transaction Audit Trail
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {transactions.length} Transaction{transactions.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingTransactions ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Loading account transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No transactions found for this account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5">Ref Type</th>
                  <th className="px-6 py-3.5 text-right">Inflow (Credit)</th>
                  <th className="px-6 py-3.5 text-right">Outflow (Debit)</th>
                  <th className="px-6 py-3.5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {transactions.map((t) => {
                  const isCredit = t.type === 'CREDIT';
                  return (
                    <tr key={t._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={isCredit ? 'success' : 'danger'}>
                          {t.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        {t.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {t.referenceType || 'DIRECT'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-400">
                        {isCredit ? `+${formatCurrency(t.amount)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-rose-400">
                        {!isCredit ? `-${formatCurrency(t.amount)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-100">
                        {formatCurrency(t.balanceAfter)}
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
