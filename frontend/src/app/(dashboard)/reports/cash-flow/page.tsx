'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, RefreshCw, Printer, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';

interface Line {
  date: string;
  entryNo: string;
  narration: string;
  source: string;
  amount: number;
  direction: 'IN' | 'OUT';
}

interface Wallet {
  _id: string;
  name: string;
  balance: number;
}

interface CashFlow {
  from: string | null;
  to: string | null;
  wallets: Wallet[];
  bySource: Array<{ source: string; in: number; out: number; net: number }>;
  lines: Line[];
  totalIn: number;
  totalOut: number;
  netChange: number;
  opening: number;
  closing: number;
}

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CashFlowPage() {
  const toast = useToast();
  const [data, setData] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CashFlow>('/accounting/cash-flow', {
        params: { from: from || undefined, to: to || undefined },
      });
      setData(res.data || null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the cash flow');
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
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Cash Flow</h1>
            <p className="text-sm text-slate-400">Money in and out of the till, bank and mobile wallets.</p>
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

      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
          Building the cash flow…
        </div>
      ) : !data ? (
        <div className="py-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-sm">No data.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Opening', value: data.opening, tone: 'text-slate-100' },
              { label: 'Money in', value: data.totalIn, tone: 'text-emerald-400' },
              { label: 'Money out', value: data.totalOut, tone: 'text-rose-400' },
              { label: 'Closing', value: data.closing, tone: 'text-slate-100' },
            ].map((k) => (
              <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className={`text-lg font-bold mt-1 ${k.tone}`}>{money(k.value)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-slate-100">Wallets</h2>
              </div>
              <div className="divide-y divide-slate-800 text-sm">
                {data.wallets.map((w) => (
                  <div key={w._id} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-slate-300">{w.name}</span>
                    <span className="text-slate-100">{money(w.balance)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-slate-100">By source</h2>
              </div>
              <div className="divide-y divide-slate-800 text-sm">
                {data.bySource.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">No movements in this range.</div>
                ) : (
                  data.bySource.map((s) => (
                    <div key={s.source} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-slate-300">{s.source.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className={s.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money(s.net)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Movements</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Voucher</th>
                    <th className="py-2.5 px-4">Narration</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                        No cash movements in this range.
                      </td>
                    </tr>
                  ) : (
                    [...data.lines].reverse().map((l, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(l.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-400">{l.entryNo}</td>
                        <td className="py-2.5 px-4 text-slate-200">{l.narration}</td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              l.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {l.direction === 'IN' ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            {money(l.amount)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
