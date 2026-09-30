'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Receipt, RotateCcw, TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { Tabs } from '../../../components/ui/Tabs';
import { useAuth } from '../../../hooks/useAuth';

interface MySalesReport {
  summary: {
    today: { count: number; total: number };
    month: { count: number; total: number };
    monthReturns: { count: number; total: number };
  };
  recentSales: any[];
  recentReturns: any[];
}

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);

export default function MySalesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sales');
  const [page, setPage] = useState(1);

  const { data: report, isLoading, refetch, isRefetching } = useQuery<MySalesReport>({
    queryKey: ['my-sales-report'],
    queryFn: async () => (await api.get('/reports/my-sales')).data,
  });

  const { data: salesData } = useQuery({
    queryKey: ['my-sales-list', page],
    queryFn: async () => {
      const res = await api.get(`/sales?mine=true&page=${page}&limit=15`);
      return { rows: Array.isArray(res.data) ? res.data : res.data?.data || [], total: res.meta?.totalItems || 0, totalPages: res.meta?.totalPages || 1 };
    },
  });

  const { data: returnsData } = useQuery({
    queryKey: ['my-returns-list', page],
    queryFn: async () => {
      const res = await api.get(`/returns?mine=true&page=${page}&limit=15`);
      return { rows: Array.isArray(res.data) ? res.data : res.data?.data || [], total: res.meta?.totalItems || 0, totalPages: res.meta?.totalPages || 1 };
    },
  });

  const s = report?.summary;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">My Sales</h1>
            <p className="text-sm text-slate-400">
              Your own sales, returns and performance — {user?.fullName || user?.username}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {isLoading || !s ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider mb-2">
              <CalendarDays className="w-4 h-4 text-blue-400" /> Today
            </div>
            <p className="text-2xl font-bold text-white">{money(s.today.total)}</p>
            <p className="text-[11px] text-slate-500 mt-1">{s.today.count} invoice{s.today.count === 1 ? '' : 's'} made by you</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> This month
            </div>
            <p className="text-2xl font-bold text-white">{money(s.month.total)}</p>
            <p className="text-[11px] text-slate-500 mt-1">{s.month.count} invoice{s.month.count === 1 ? '' : 's'} this month</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider mb-2">
              <RotateCcw className="w-4 h-4 text-rose-400" /> My returns (month)
            </div>
            <p className="text-2xl font-bold text-white">{money(s.monthReturns.total)}</p>
            <p className="text-[11px] text-slate-500 mt-1">{s.monthReturns.count} return{s.monthReturns.count === 1 ? '' : 's'}</p>
          </div>
        </div>
      )}

      {/* Lists */}
      <div className="space-y-3">
        <Tabs
          tabs={[
            { key: 'sales', label: 'My Sales', count: salesData?.total },
            { key: 'returns', label: 'My Returns', count: returnsData?.total },
          ]}
          activeTab={activeTab}
          onChange={(k) => { setActiveTab(k); setPage(1); }}
          variant="pills"
        />

        {activeTab === 'sales' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Invoice</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Payment</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(salesData?.rows || []).map((sale: any) => (
                  <tr key={sale._id || sale.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 text-white font-medium">{sale.invoiceNo}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(sale.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-slate-300">{sale.customerId?.name || <span className="text-slate-600">Walk-in</span>}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(sale.payments || []).map((p: any, i: number) => (
                          <Badge key={i} variant="info" size="sm">{p.method.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-white font-semibold">{money(sale.totalAmount)}</td>
                  </tr>
                ))}
                {(salesData?.rows || []).length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">You have not made any sales yet.</td></tr>
                )}
              </tbody>
            </table>
            {(salesData?.totalPages || 1) > 1 && (
              <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Page {page} of {salesData?.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= (salesData?.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'returns' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Return</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Invoice</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-right">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(returnsData?.rows || []).map((ret: any) => (
                  <tr key={ret._id || ret.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 text-white font-medium">{ret.returnNo}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(ret.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-slate-300">{ret.saleId?.invoiceNo || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-300">{ret.customerId?.name || <span className="text-slate-600">Walk-in</span>}</td>
                    <td className="px-5 py-3.5"><Badge variant="warning" size="sm">{ret.refundType.replace('_', ' ')}</Badge></td>
                    <td className="px-5 py-3.5 text-right text-rose-300 font-semibold">{money(ret.totalRefundAmount)}</td>
                  </tr>
                ))}
                {(returnsData?.rows || []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No returns yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
