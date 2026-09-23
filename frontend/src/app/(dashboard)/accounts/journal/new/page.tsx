'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Plus, Trash2, Check, RefreshCw, ArrowLeft } from 'lucide-react';
import { api } from '../../../../../lib/api-client';
import { useToast } from '../../../../../components/ui';

interface AccountHead {
  _id: string;
  code?: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface Line {
  key: number;
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
}

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);

let keySeed = 1;
const blankLine = (): Line => ({ key: keySeed++, accountId: '', debit: 0, credit: 0, memo: '' });

export default function NewJournalVoucherPage() {
  const router = useRouter();
  const toast = useToast();

  const [heads, setHeads] = useState<AccountHead[]>([]);
  const [loadingHeads, setLoadingHeads] = useState(true);
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<AccountHead[]>('/accounting/accounts');
        setHeads((res.data || []).filter((a) => a.isActive));
      } catch (err: any) {
        toast.error(err?.message || 'Could not load the chart of accounts');
      } finally {
        setLoadingHeads(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const debit = lines.reduce((n, l) => n + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((n, l) => n + (Number(l.credit) || 0), 0);
    return { debit, credit, difference: Math.round((debit - credit) * 100) / 100 };
  }, [lines]);

  const balanced = Math.abs(totals.difference) < 0.005 && totals.debit > 0;
  const usedLines = lines.filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0));

  const patch = (key: number, changes: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  const save = async () => {
    setError('');
    if (!narration.trim()) {
      setError('A narration is required — describe what this voucher is for.');
      return;
    }
    if (!balanced) {
      setError(`The voucher does not balance — debit ${money(totals.debit)} vs credit ${money(totals.credit)}.`);
      return;
    }
    if (usedLines.length < 2) {
      setError('A voucher needs at least two complete lines.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ entryNo: string }>('/accounting/journal', {
        date,
        narration: narration.trim(),
        source: 'MANUAL',
        lines: usedLines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          memo: l.memo.trim() || undefined,
        })),
      });
      toast.success(
        `Voucher ${res.data?.entryNo || ''} submitted — it posts once an admin approves it`,
        'Waiting for approval'
      );
      router.push('/accounts/journal');
    } catch (err: any) {
      setError(err?.message || 'Could not post the voucher');
    } finally {
      setSaving(false);
    }
  };

  const numInput = (value: number, onChange: (v: number) => void, disabled: boolean) => (
    <input
      type="text"
      inputMode="decimal"
      value={value === 0 ? '' : String(value)}
      disabled={disabled}
      placeholder="0.00"
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, '');
        onChange(Number(raw) || 0);
      }}
      className={`w-full px-3 py-2 text-right rounded-lg border bg-slate-800 text-white focus:outline-none ${
        disabled ? 'border-slate-800 text-slate-600' : 'border-slate-700 focus:border-indigo-500'
      }`}
    />
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white tracking-tight">New Journal Voucher</h1>
          <p className="text-sm text-slate-400">
            Post anything the till cannot capture — capital, loans, depreciation, adjustments.
          </p>
        </div>
        <Link
          href="/accounts/journal"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Day Book
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Voucher date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Narration *</label>
            <input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Owner brought in capital"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Lines */}
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-950/50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
            <div className="col-span-4">Account</div>
            <div className="col-span-3">Memo</div>
            <div className="col-span-2 text-right">Debit</div>
            <div className="col-span-2 text-right">Credit</div>
            <div className="col-span-1" />
          </div>
          <div className="divide-y divide-slate-800">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                <div className="col-span-4">
                  <select
                    value={l.accountId}
                    onChange={(e) => patch(l.key, { accountId: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">{loadingHeads ? 'Loading…' : 'Select account'}</option>
                    {heads.map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.code ? `${h.code} · ` : ''}
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    value={l.memo}
                    onChange={(e) => patch(l.key, { memo: e.target.value })}
                    placeholder="optional"
                    className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  {numInput(Number(l.debit) || 0, (v) => patch(l.key, { debit: v, credit: v > 0 ? 0 : l.credit }), (Number(l.credit) || 0) > 0)}
                </div>
                <div className="col-span-2">
                  {numInput(Number(l.credit) || 0, (v) => patch(l.key, { credit: v, debit: v > 0 ? 0 : l.debit }), (Number(l.debit) || 0) > 0)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => setLines((prev) => (prev.length > 2 ? prev.filter((x) => x.key !== l.key) : prev))}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Remove line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-2 px-3 py-3 bg-slate-950/50 border-t border-slate-800 text-sm font-semibold">
            <div className="col-span-7 text-slate-400">Totals</div>
            <div className="col-span-2 text-right text-slate-100">{money(totals.debit)}</div>
            <div className="col-span-2 text-right text-slate-100">{money(totals.credit)}</div>
            <div className="col-span-1" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setLines((prev) => [...prev, blankLine()])}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add line
          </button>

          <div className="text-xs font-semibold">
            {balanced ? (
              <span className="text-emerald-400">Balanced — ready to post</span>
            ) : (
              <span className="text-amber-400">
                Difference {money(Math.abs(totals.difference))} {totals.difference > 0 ? '(debit heavy)' : '(credit heavy)'}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">{error}</div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link
            href="/accounts/journal"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Cancel
          </Link>
          <button
            onClick={save}
            disabled={saving || !balanced}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Post Voucher
          </button>
        </div>
      </div>
    </div>
  );
}
