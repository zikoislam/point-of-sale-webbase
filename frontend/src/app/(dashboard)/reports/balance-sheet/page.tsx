'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Scale, RefreshCw, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';

interface Row {
  code?: string;
  name: string;
  subType: string;
  amount: number;
}

interface BalanceSheet {
  asOf: string | null;
  assets: Row[];
  liabilities: Row[];
  equity: Row[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netProfit: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Section: React.FC<{ title: string; rows: Row[]; total: number; extra?: React.ReactNode }> = ({
  title,
  rows,
  total,
  extra,
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <span className="text-sm font-bold text-slate-100">{money(total)}</span>
    </div>
    {rows.length === 0 && !extra ? (
      <div className="py-6 text-center text-xs text-slate-500">Nothing here yet.</div>
    ) : (
      <div className="divide-y divide-slate-800 text-sm">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-2.5">
            <span className="text-slate-300">
              <span className="font-mono text-xs text-slate-500 mr-2">{r.code}</span>
              {r.name}
            </span>
            <span className="text-slate-200">{money(r.amount)}</span>
          </div>
        ))}
        {extra}
      </div>
    )}
  </div>
);

export default function BalanceSheetPage() {
  const toast = useToast();
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState('');

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BalanceSheet>('/accounting/balance-sheet', {
        params: { asOf: asOf || undefined },
      });
      setData(res.data || null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the balance sheet');
    } finally {
      setLoading(false);
    }
  }, [asOf, toast]);

  useEffect(() => {
    fetchStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Balance Sheet</h1>
            <p className="text-sm text-slate-400">What the shop owns, what it owes, and what belongs to the owner.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
          />
          <button
            onClick={fetchStatement}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
          Building the balance sheet…
        </div>
      ) : !data ? (
        <div className="py-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-sm">No data.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Assets" rows={data.assets} total={data.totalAssets} />

          <div className="space-y-6">
            <Section title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} />
            <Section
              title="Equity"
              rows={data.equity}
              total={data.totalEquity}
              extra={
                <div className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-slate-300 italic">Profit for the period</span>
                  <span className="text-slate-200">{money(data.netProfit)}</span>
                </div>
              }
            />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                  {data.balanced ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  Liabilities + Equity
                </span>
                <span className="font-bold text-slate-100">{money(data.totalLiabilitiesAndEquity)}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                <span>Total assets</span>
                <span>{money(data.totalAssets)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
