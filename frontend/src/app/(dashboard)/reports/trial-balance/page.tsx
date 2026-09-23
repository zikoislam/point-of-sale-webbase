'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Scale, RefreshCw, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';

interface Row {
  accountId: string;
  code?: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface TrialBalance {
  from: string | null;
  to: string | null;
  rows: Row[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TrialBalancePage() {
  const toast = useToast();
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TrialBalance>('/accounting/trial-balance', {
        params: { from: from || undefined, to: to || undefined },
      });
      setData(res.data || null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the trial balance');
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => {
    fetchStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Trial Balance</h1>
            <p className="text-sm text-slate-400">Every head's balance at a glance — debits must equal credits.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
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

      <div className="print:hidden flex flex-wrap items-end gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-xs">
        <div>
          <label className="block text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
          />
        </div>
        <button
          onClick={fetchStatement}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold transition"
        >
          Apply
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
            Building the trial balance…
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-500 text-sm">No data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4 text-right">Debit</th>
                  <th className="py-3 px-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.rows.map((r) => (
                  <tr key={r.accountId} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">{r.code || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-200">{r.name}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">{r.type}</td>
                    <td className="py-2.5 px-4 text-right text-slate-100">{r.debit ? money(r.debit) : '—'}</td>
                    <td className="py-2.5 px-4 text-right text-slate-100">{r.credit ? money(r.credit) : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-slate-950/60 font-bold">
                  <td className="py-3 px-4" colSpan={3}>
                    <span className="inline-flex items-center gap-2 text-slate-200">
                      {data.balanced ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      )}
                      Total {data.balanced ? '(balanced)' : '(OUT OF BALANCE)'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-100">{money(data.totalDebit)}</td>
                  <td className="py-3 px-4 text-right text-slate-100">{money(data.totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
