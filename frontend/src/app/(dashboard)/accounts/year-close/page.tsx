'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, RefreshCw, Lock, Unlock, ShieldAlert, Info, Check } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';
import { useAuth } from '../../../../hooks/useAuth';

interface Row {
  code?: string;
  name: string;
  subType: string;
  amount: number;
}

interface ProfitLoss {
  from: string | null;
  to: string | null;
  income: Row[];
  expenses: Row[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);

export default function YearClosePage() {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [closedUpTo, setClosedUpTo] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(today());
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api.get<{ booksClosedUpTo: string | null }>('/accounting/period-status');
      const closed = status.data?.booksClosedUpTo || null;
      setClosedUpTo(closed);

      const from = closed ? new Date(new Date(closed).getTime() + 86400000).toISOString().slice(0, 10) : undefined;
      const res = await api.get<ProfitLoss>('/accounting/profit-loss', {
        params: { from, to: asOf || undefined },
      });
      setPl(res.data || null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the year');
    } finally {
      setLoading(false);
    }
  }, [asOf, toast]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeYear = async () => {
    if (!confirm(`Close the books up to ${asOf}? Income and expense will be zeroed into Retained Earnings and the period will be locked.`)) {
      return;
    }
    setWorking(true);
    try {
      const res = await api.post('/accounting/year-close', { asOf });
      setResult(res.data);
      toast.success(`Year closed — voucher ${res.data?.entryNo}`, 'Books locked');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not close the year');
    } finally {
      setWorking(false);
    }
  };

  const reopen = async () => {
    if (!confirm('Reopen the closed period? Corrections can then be posted into it.')) return;
    setWorking(true);
    try {
      const res = await api.post('/accounting/reopen-books');
      toast.success(`Books reopened up to ${res.data?.reopenedUpTo}`, 'Period unlocked');
      setResult(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not reopen the books');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Year End Closing</h1>
            <p className="text-sm text-slate-400">
              Zero the year's income and expense into Retained Earnings, then lock the period.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={load}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {closedUpTo ? (
            <button
              onClick={reopen}
              disabled={!isSuperAdmin || working}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-amber-300 text-sm font-medium transition"
            >
              <Unlock className="w-4 h-4" />
              Reopen books
            </button>
          ) : (
            <button
              onClick={closeYear}
              disabled={!isSuperAdmin || working}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition shadow-lg shadow-amber-600/20"
            >
              {working ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Close the year
            </button>
          )}
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          Closing the year is restricted to the <strong>Super Admin</strong>. You can review the figures here.
        </div>
      )}

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500">Books closed up to</p>
          <p className="text-lg font-bold text-slate-100 mt-1">{closedUpTo ? closedUpTo.slice(0, 10) : 'Not closed'}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {closedUpTo ? 'Posting on or before this day is refused.' : 'Every date is still open.'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:col-span-2">
          <p className="text-xs text-slate-500">Closing date</p>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Show this year
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Usually your fiscal year end — e.g. 30 June or 31 December.
          </p>
        </div>
      </div>

      {/* The year's result */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
          Loading the year…
        </div>
      ) : pl ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Income</h2>
              <span className="text-sm font-bold text-cyan-300">{money(pl.totalIncome)}</span>
            </div>
            <div className="divide-y divide-slate-800 text-sm">
              {pl.income.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No income in this period.</div>
              ) : (
                pl.income.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-slate-300">{r.name}</span>
                    <span className="text-slate-200">{money(r.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Expenses</h2>
              <span className="text-sm font-bold text-rose-300">{money(pl.totalExpense)}</span>
            </div>
            <div className="divide-y divide-slate-800 text-sm">
              {pl.expenses.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No expenses in this period.</div>
              ) : (
                pl.expenses.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-slate-300">{r.name}</span>
                    <span className="text-slate-200">{money(r.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">
              {pl.netProfit >= 0 ? 'Profit for the year' : 'Loss for the year'}
            </span>
            <span className={`text-lg font-bold ${pl.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {money(Math.abs(pl.netProfit))}
            </span>
          </div>
        </div>
      ) : null}

      {result && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-xs text-emerald-200">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-100">Year closed — voucher {result.entryNo}</p>
            <p className="mt-1">
              {result.incomeClosed} income and {result.expenseClosed} expense head(s) were zeroed into Retained
              Earnings ({money(result.netProfit)} {result.netProfit >= 0 ? 'profit' : 'loss'}) and the books are locked
              up to {String(result.closedUpTo).slice(0, 10)}.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p>
          Closing does not delete anything: a single voucher zeroes each income and expense head and moves the
          difference to <span className="text-slate-200">Retained Earnings (3030)</span>. After that the period is
          locked, so a voucher dated inside it is refused until you reopen the books.
        </p>
      </div>
    </div>
  );
}
