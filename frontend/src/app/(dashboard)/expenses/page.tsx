'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { NumberInput } from '../../../components/ui/NumberInput';
import {
  Receipt,
  Plus,
  Tag,
  DollarSign,
  Calendar,
  Layers,
  Search,
  Check,
  X,
  RefreshCw,
  FolderPlus,
  CreditCard,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  'Content-Type': 'application/json',
});
const fetchOpts = (opts: RequestInit = {}): RequestInit => ({
  ...opts,
  credentials: 'include' as RequestCredentials,
  headers: { ...authHeader(), ...(opts.headers as Record<string, string> || {}) },
});

interface Expense {
  _id: string;
  categoryId: { _id: string; name: string; code: string };
  amount: number;
  accountId: { _id: string; name: string; accountType: string };
  description: string;
  createdById?: { name: string };
  createdAt: string;
}

interface ExpenseCategory {
  _id: string;
  name: string;
  code: string;
}

interface Account {
  _id: string;
  name: string;
  currentBalance: number;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form states
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expCategory, setExpCategory] = useState('');
  const [expAccount, setExpAccount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState('');

  // Category Form
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  const fetchDropdowns = async () => {
    try {
      const [cRes, aRes] = await Promise.all([
        fetch(`${API}/expenses/categories`, fetchOpts()),
        fetch(`${API}/accounts`, fetchOpts()),
      ]);
      const [cJson, aJson] = await Promise.all([cRes.json(), aRes.json()]);
      if (cJson.success) setCategories(cJson.data || []);
      if (aJson.success) setAccounts(aJson.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/expenses?limit=50`, fetchOpts());
      const j = await res.json();
      if (j.success) setExpenses(j.data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDropdowns();
    fetchExpenses();
  }, [fetchExpenses]);

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  const openAddModal = () => {
    setExpAmount(0);
    setExpCategory(categories[0]?._id || '');
    setExpAccount(accounts[0]?._id || '');
    setExpDesc('');
    setExpError('');
    setShowAddModal(true);
  };

  const handleAddExpense = async () => {
    if (expAmount <= 0) {
      setExpError('Amount must be greater than 0');
      return;
    }
    if (!expCategory) {
      setExpError('Please select an expense category');
      return;
    }
    if (!expAccount) {
      setExpError('Please select a payment account');
      return;
    }
    if (!expDesc.trim()) {
      setExpError('Description is required');
      return;
    }

    setExpSaving(true);
    setExpError('');

    try {
      const res = await fetch(`${API}/expenses`, fetchOpts({
        method: 'POST',
        body: JSON.stringify({
          amount: Number(expAmount),
          categoryId: expCategory,
          accountId: expAccount,
          description: expDesc.trim(),
        }),
      }));

      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message || j.message || 'Failed to record expense');

      setShowAddModal(false);
      fetchExpenses();
    } catch (e: any) {
      setExpError(e.message);
    } finally {
      setExpSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!catName.trim() || !catCode.trim()) {
      setCatError('Both category name and unique code are required');
      return;
    }
    setCatSaving(true);
    setCatError('');

    try {
      const res = await fetch(`${API}/expenses/categories`, fetchOpts({
        method: 'POST',
        body: JSON.stringify({
          name: catName.trim(),
          code: catCode.trim().toUpperCase(),
        }),
      }));

      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message || j.message || 'Failed to create category');

      setCatName('');
      setCatCode('');
      setShowCategoryModal(false);
      fetchDropdowns();
    } catch (e: any) {
      setCatError(e.message);
    } finally {
      setCatSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Business Expenses</h1>
            <p className="text-sm text-slate-400">
              Track operational costs, shop utilities, petty cash disbursements & staff allowances
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchExpenses}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setCatName('');
              setCatCode('');
              setCatError('');
              setShowCategoryModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-orange-400" />
            <span>Categories</span>
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs transition shadow-lg shadow-orange-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Expense Summary KPI */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/30 border border-orange-500/30 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-orange-400">
            Total Logged Expenses
          </div>
          <div className="text-3xl font-black text-white mt-1">
            ৳{totalExpenseAmount.toFixed(2)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Across {expenses.length} expense transactions
          </p>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
          <DollarSign className="w-8 h-8" />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Debited Account</th>
                <th className="py-3.5 px-4">Recorded By</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-400" />
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No expense records found. Click "Record Expense" to add one.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-300 border border-orange-500/20">
                        {e.categoryId?.name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                      {e.description}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {e.accountId?.name || 'Cash'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {e.createdById?.name || 'Staff'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-rose-400">
                      ৳{e.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Record Business Expense</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {expError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {expError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Expense Amount (৳) *
                </label>
                <NumberInput
                  value={expAmount}
                  onValueChange={setExpAmount}
                  min={1}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Paid From Account *
                </label>
                <select
                  value={expAccount}
                  onChange={(e) => setExpAccount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select Account</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} (Balance: ৳{a.currentBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Shop electricity bill for Sept, Cleaning supplies"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                disabled={expSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-orange-600/20"
              >
                {expSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Record Expense</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create Expense Category</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {catError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {catError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Staff Salaries, Office Supplies"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Unique Code *
                </label>
                <input
                  type="text"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  placeholder="e.g. SALARY, UTILITIES"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white uppercase focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Existing Categories:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {categories.map((c) => (
                    <span
                      key={c._id}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-700 text-slate-300"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={catSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-orange-600/20"
              >
                {catSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Category</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
