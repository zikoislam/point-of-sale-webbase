'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Landmark, Plus, RefreshCw, BookOpen, X, Check, Wallet } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useToast } from '../../../../components/ui';

interface AccountHead {
  _id: string;
  code?: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  subType: string;
  accountType: string;
  isCashEquivalent: boolean;
  isSystem: boolean;
  normalBalance: 'DEBIT' | 'CREDIT';
  currentBalance: number;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};

const TYPE_COLOR: Record<string, string> = {
  ASSET: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  LIABILITY: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  EQUITY: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
  INCOME: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  EXPENSE: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
};

const money = (n: number) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ChartOfAccountsPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<AccountHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AccountHead['type']>('ASSET');
  const [formSubType, setFormSubType] = useState('OTHER_ASSET');
  const [formOpening, setFormOpening] = useState(0);

  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AccountHead[]>('/accounting/accounts');
      setAccounts(res.data || []);
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

  const openCreate = () => {
    setFormCode('');
    setFormName('');
    setFormType('ASSET');
    setFormSubType('OTHER_ASSET');
    setFormOpening(0);
    setFormError('');
    setShowCreate(true);
  };

  const subTypesFor = (type: AccountHead['type']) => {
    switch (type) {
      case 'ASSET':
        return ['FIXED_ASSET', 'INVENTORY', 'RECEIVABLE', 'OTHER_ASSET'];
      case 'LIABILITY':
        return ['LOAN', 'TAX', 'PAYABLE', 'OTHER_LIABILITY'];
      case 'EQUITY':
        return ['CAPITAL', 'DRAWINGS', 'RETAINED'];
      case 'INCOME':
        return ['OTHER_INCOME', 'SALES'];
      default:
        return ['OPERATING', 'COGS', 'WASTAGE', 'OTHER_EXPENSE'];
    }
  };

  const handleCreate = async () => {
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Code and name are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.post('/accounting/accounts', {
        code: formCode.trim(),
        name: formName.trim(),
        type: formType,
        subType: formSubType,
        openingBalance: Number(formOpening) || 0,
      });
      toast.success('Account head created');
      setShowCreate(false);
      await fetchChart();
    } catch (err: any) {
      setFormError(err?.message || 'Could not create the account');
    } finally {
      setSaving(false);
    }
  };

  const grouped = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map((type) => ({
    type,
    rows: accounts.filter((a) => a.type === type),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Chart of Accounts</h1>
            <p className="text-sm text-slate-400">
              Every head the books are kept in. Wallet balances, receivables and stock all sit here.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchChart}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/accounts/journal"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition"
          >
            <BookOpen className="w-4 h-4" />
            Day Book
          </Link>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            New Head
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading the chart…
        </div>
      ) : (
        grouped.map(({ type, rows }) => (
          <div key={type} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLOR[type]}`}>
                {type}
              </span>
              <h2 className="text-sm font-semibold text-slate-100">{TYPE_LABEL[type]}</h2>
              <span className="ml-auto text-xs text-slate-500">{rows.length} head(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                        No {TYPE_LABEL[type].toLowerCase()} heads yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((a) => (
                      <tr key={a._id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{a.code || '—'}</td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/accounts/${a._id}/transactions`}
                            className="text-slate-200 hover:text-indigo-300 font-medium inline-flex items-center gap-1.5"
                          >
                            {a.isCashEquivalent && <Wallet className="w-3.5 h-3.5 text-emerald-400" />}
                            {a.name}
                          </Link>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {a.subType.replace(/_/g, ' ').toLowerCase()}
                            {a.isSystem ? ' · system' : ''}
                            {a.isActive ? '' : ' · inactive'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">{a.normalBalance}</td>
                        <td
                          className={`py-3 px-4 text-right font-semibold ${
                            a.currentBalance < 0 ? 'text-rose-400' : 'text-slate-100'
                          }`}
                        >
                          {money(a.currentBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Create head */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">New Account Head</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Code *</label>
                  <input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="1520"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Name *</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Delivery Van"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Group</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as AccountHead['type'];
                      setFormType(t);
                      setFormSubType(subTypesFor(t)[0]);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {Object.entries(TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sub type</label>
                  <select
                    value={formSubType}
                    onChange={(e) => setFormSubType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {subTypesFor(formType).map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Opening balance (৳)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formOpening}
                  onChange={(e) => setFormOpening(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Books a brought-forward voucher against Opening Balance Equity.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Head
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
