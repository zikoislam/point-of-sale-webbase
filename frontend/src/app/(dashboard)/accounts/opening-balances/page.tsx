'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, RefreshCw, Check, Info, ShieldAlert } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';
import { useAuth } from '../../../../hooks/useAuth';

interface AccountHead {
  _id: string;
  code?: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  subType: string;
  isCashEquivalent: boolean;
  currentBalance: number;
  openingBalance?: number;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OpeningBalancesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [heads, setHeads] = useState<AccountHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AccountHead[]>('/accounting/accounts');
      setHeads(res.data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load the chart of accounts');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (head: AccountHead) => {
    const raw = draft[head._id];
    const amount = Number(String(raw || '').replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) {
      toast.error('Enter an amount greater than zero');
      return;
    }

    setSaving(head._id);
    try {
      const res = await api.post<{ entryNo: string }>('/accounting/opening-balances', {
        accountId: head._id,
        amount,
      });
      toast.success(`Opening balance posted (${res.data?.entryNo || ''})`, head.name);
      setDraft((prev) => ({ ...prev, [head._id]: '' }));
      await fetchChart();
    } catch (err: any) {
      toast.error(err?.message || 'Could not post the opening balance');
    } finally {
      setSaving(null);
    }
  };

  const grouped = ['ASSET', 'LIABILITY', 'EQUITY'].map((type) => ({
    type,
    rows: heads.filter((h) => h.type === type),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Opening Balances</h1>
            <p className="text-sm text-slate-400">
              Bring your existing books in — capital, loans, furniture, stock, cash. Each one posts a proper voucher.
            </p>
          </div>
        </div>
        <button
          onClick={fetchChart}
          className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          Opening balances change the whole books, so only the <strong>Super Admin</strong> can post them. You can
          still review the figures here.
        </div>
      )}

      <div className="flex items-start gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p>
          Enter the value a head should carry at the day your books start (e.g. <span className="text-slate-200">Capital
          ৳5,00,000</span>, <span className="text-slate-200">Loan ৳2,00,000</span>). The app debits or credits that head
          against <span className="text-slate-200">Opening Balance Equity</span>, so the trial balance stays balanced.
          Each head can be posted once — edit the voucher afterwards if you need to correct it.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading the chart…
        </div>
      ) : (
        grouped.map(({ type, rows }) => (
          <div key={type} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">{TYPE_LABEL[type]}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account</th>
                    <th className="py-2.5 px-4 text-right">Already opening</th>
                    <th className="py-2.5 px-4 text-right">Book balance</th>
                    <th className="py-2.5 px-4 text-right">Set opening (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((h) => (
                    <tr key={h._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-400">{h.code || '—'}</td>
                      <td className="py-2.5 px-4">
                        <div className="text-slate-200">{h.name}</div>
                        <div className="text-[10px] text-slate-500">{h.subType.replace(/_/g, ' ').toLowerCase()}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{money(h.openingBalance || 0)}</td>
                      <td className="py-2.5 px-4 text-right text-slate-100">{money(h.currentBalance)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!isSuperAdmin}
                            value={draft[h._id] || ''}
                            placeholder="0.00"
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [h._id]: e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''),
                              }))
                            }
                            className="w-28 px-2.5 py-1.5 text-right bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          />
                          <button
                            onClick={() => post(h)}
                            disabled={!isSuperAdmin || saving === h._id || !draft[h._id]}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition"
                            title="Post this opening balance"
                          >
                            {saving === h._id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Post
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
