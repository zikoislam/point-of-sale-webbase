'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, RefreshCw, ChevronDown, ChevronRight, Ban, Check, X, Clock } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';
import { useAuth } from '../../../../hooks/useAuth';

interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

interface JournalEntry {
  _id: string;
  entryNo: string;
  date: string;
  narration: string;
  source: string;
  referenceType?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  status?: 'PENDING' | 'POSTED' | 'REJECTED';
  rejectedReason?: string;
  isReversed: boolean;
  isSystemGenerated: boolean;
}

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SOURCE_COLOR: Record<string, string> = {
  SALE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  EXPENSE: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  PURCHASE: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  MANUAL: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  OPENING: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  BACKFILL: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

/** A voucher only counts once it is POSTED; rows created before approvals have no status. */
const statusOf = (entry: JournalEntry) => entry.status || 'POSTED';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  POSTED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  REJECTED: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
};

export default function DayBookPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canApprove = isSuperAdmin || user?.role === 'ADMIN' || !!user?.permissions?.includes('approvals:manage');

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState<string | null>(null);

  const fetchBook = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<JournalEntry[]>('/accounting/journal', {
        params: {
          from: from || undefined,
          to: to || undefined,
          source: source || undefined,
          status: status || undefined,
          limit: 100,
        },
      });
      setEntries(res.data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the day book');
    } finally {
      setLoading(false);
    }
  }, [from, to, source, status, toast]);

  useEffect(() => {
    fetchBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverse = async (entry: JournalEntry) => {
    if (!confirm(`Reverse ${entry.entryNo}? A mirror voucher will be posted.`)) return;
    setWorking(entry._id);
    try {
      await api.post(`/accounting/journal/${entry._id}/reverse`);
      toast.success(`${entry.entryNo} reversed`);
      await fetchBook();
    } catch (err: any) {
      toast.error(err?.message || 'Could not reverse the voucher');
    } finally {
      setWorking(null);
    }
  };

  const decide = async (entry: JournalEntry, approve: boolean) => {
    let reason: string | undefined;
    if (!approve) {
      const asked = prompt(`Why is ${entry.entryNo} being rejected?`);
      if (asked === null) return;
      reason = asked || undefined;
    }

    setWorking(entry._id);
    try {
      await api.post(`/accounting/journal/${entry._id}/approve`, { approve, reason });
      toast.success(
        approve ? `${entry.entryNo} approved and posted to the books` : `${entry.entryNo} rejected`,
        approve ? 'Posted' : 'Rejected'
      );
      await fetchBook();
    } catch (err: any) {
      toast.error(err?.message || 'Could not update the voucher');
    } finally {
      setWorking(null);
    }
  };

  const showPending = () => {
    setStatus('PENDING');
  };

  const pendingCount = entries.filter((e) => statusOf(e) === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Day Book</h1>
            <p className="text-sm text-slate-400">
              Every voucher, newest first. A hand-written voucher waits for approval before it touches the books.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchBook}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/accounts/journal/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            New Voucher
          </Link>
        </div>
      </div>

      {pendingCount > 0 && status !== 'PENDING' && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            <strong>{pendingCount}</strong> voucher{pendingCount > 1 ? 's are' : ' is'} waiting for approval — they do
            not affect the books until approved.
          </span>
          <button
            onClick={showPending}
            className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 font-semibold transition"
          >
            Show pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-xs">
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
        <div>
          <label className="block text-slate-400 mb-1">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
          >
            <option value="">All</option>
            {['SALE', 'SALE_RETURN', 'PURCHASE', 'EXPENSE', 'WASTAGE', 'TRANSFER', 'DUE_COLLECTION', 'SUPPLIER_PAYMENT', 'MANUAL', 'OPENING', 'ADJUSTMENT', 'BACKFILL', 'YEAR_CLOSE'].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
          >
            <option value="">All</option>
            <option value="PENDING">Pending approval</option>
            <option value="POSTED">Posted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <button
          onClick={fetchBook}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold transition"
        >
          Apply
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
            Loading vouchers…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No vouchers in this range.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {entries.map((entry) => {
              const open = !!expanded[entry._id];
              const st = statusOf(entry);
              return (
                <div key={entry._id}>
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [entry._id]: !open }))}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-800/40 transition"
                  >
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">{entry.entryNo}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            SOURCE_COLOR[entry.source] || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {entry.source}
                        </span>
                        {st !== 'POSTED' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[st]}`}>
                            {st === 'PENDING' ? 'WAITING APPROVAL' : st}
                          </span>
                        )}
                        {entry.isReversed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-300 border-rose-500/20">
                            REVERSED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 truncate mt-0.5">{entry.narration}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-slate-100">{money(entry.totalDebit)}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(entry.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </button>

                  {open && (
                    <div className="px-5 pb-4 bg-slate-950/40">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 uppercase">
                            <th className="text-left py-2 font-semibold">Account</th>
                            <th className="text-left py-2 font-semibold">Memo</th>
                            <th className="text-right py-2 font-semibold">Debit</th>
                            <th className="text-right py-2 font-semibold">Credit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {entry.lines.map((l, i) => (
                            <tr key={i}>
                              <td className="py-2 text-slate-300">
                                <span className="font-mono text-slate-500 mr-2">{l.accountCode}</span>
                                {l.accountName}
                              </td>
                              <td className="py-2 text-slate-500">{l.memo || '—'}</td>
                              <td className="py-2 text-right text-slate-200">
                                {l.debit ? money(l.debit) : '—'}
                              </td>
                              <td className="py-2 text-right text-slate-200">
                                {l.credit ? money(l.credit) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {st === 'REJECTED' && entry.rejectedReason && (
                        <p className="mt-3 text-xs text-rose-300">Rejected: {entry.rejectedReason}</p>
                      )}

                      <div className="flex items-center justify-end gap-2 mt-3">
                        {st === 'PENDING' && canApprove && (
                          <>
                            <button
                              onClick={() => decide(entry, false)}
                              disabled={working === entry._id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold transition disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() => decide(entry, true)}
                              disabled={working === entry._id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition disabled:opacity-50"
                            >
                              {working === entry._id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve &amp; post
                            </button>
                          </>
                        )}
                        {st === 'POSTED' && isSuperAdmin && !entry.isReversed && (
                          <button
                            onClick={() => reverse(entry)}
                            disabled={working === entry._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold transition disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
