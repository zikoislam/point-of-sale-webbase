'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Building,
  Smartphone,
  Plus,
  Pencil,
  ArrowRightLeft,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  RefreshCw,
  CreditCard,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface Account {
  _id: string;
  name: string;
  accountType: 'CASH' | 'BANK' | 'MFS';
  accountNumber?: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
}

interface Transaction {
  _id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  description: string;
  createdAt: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'CASH' | 'BANK' | 'MFS'>('BANK');
  const [formNumber, setFormNumber] = useState('');
  const [formInitial, setFormInitial] = useState(0);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferDesc, setTransferDesc] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Ledger Drawer Modal
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<Transaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/accounts`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) setAccounts(j.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const totalLiquidity = accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);

  const openCreateModal = () => {
    setEditTarget(null);
    setFormName('');
    setFormType('BANK');
    setFormNumber('');
    setFormInitial(0);
    setFormError('');
    setShowCreateModal(true);
  };

  const openEditModal = (a: Account) => {
    setEditTarget(a);
    setFormName(a.name);
    setFormType(a.accountType);
    setFormNumber(a.accountNumber || '');
    setFormInitial(0);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleSaveAccount = async () => {
    if (!formName.trim()) {
      setFormError('Account name is required');
      return;
    }
    setFormSaving(true);
    setFormError('');

    try {
      const payload = {
        name: formName.trim(),
        accountType: formType,
        accountNumber: formNumber.trim() || undefined,
        initialBalance: Number(formInitial) || 0,
      };

      const url = editTarget ? `${API}/accounts/${editTarget._id}` : `${API}/accounts`;
      const method = editTarget ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to save account');

      setShowCreateModal(false);
      fetchAccounts();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const openTransferModal = () => {
    if (accounts.length < 2) {
      alert('You need at least two accounts to perform fund transfers.');
      return;
    }
    setFromAccount(accounts[0]._id);
    setToAccount(accounts[1]._id);
    setTransferAmount(0);
    setTransferDesc('Internal Fund Transfer');
    setTransferError('');
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    if (fromAccount === toAccount) {
      setTransferError('Source and Destination accounts must be different');
      return;
    }
    if (transferAmount <= 0) {
      setTransferError('Transfer amount must be greater than 0');
      return;
    }

    setTransferSaving(true);
    setTransferError('');

    try {
      const res = await fetch(`${API}/accounts/transfer`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          fromAccountId: fromAccount,
          toAccountId: toAccount,
          amount: Number(transferAmount),
          description: transferDesc.trim() || 'Internal Transfer',
        }),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Transfer failed');

      setShowTransferModal(false);
      fetchAccounts();
    } catch (e: any) {
      setTransferError(e.message);
    } finally {
      setTransferSaving(false);
    }
  };

  const openLedger = async (a: Account) => {
    setSelectedAccount(a);
    setShowLedgerModal(true);
    setLoadingLedger(true);

    try {
      const res = await fetch(`${API}/accounts/${a._id}/ledger`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        setLedgerEntries(j.data.data || []);
      }
    } finally {
      setLoadingLedger(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Financial Accounts & Liquidity</h1>
            <p className="text-sm text-slate-400">
              Manage bank accounts, cash registers, mobile wallets (bKash/Nagad) & atomic fund transfers
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAccounts}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openTransferModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400" />
            <span>Transfer Funds</span>
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs transition shadow-lg shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Total Liquidity Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/30 border border-teal-500/30 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-teal-400">
            Total Combined Liquidity
          </div>
          <div className="text-3xl font-black text-white mt-1">
            ৳{totalLiquidity.toFixed(2)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Across {accounts.length} active Cash, Bank & Mobile Wallet accounts
          </p>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
          <DollarSign className="w-8 h-8" />
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((a) => {
          const Icon = a.accountType === 'CASH' ? Wallet : a.accountType === 'MFS' ? Smartphone : Building;
          return (
            <div
              key={a._id}
              className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-4 shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-sm">{a.name}</h2>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      {a.accountType} {a.accountNumber ? `• ${a.accountNumber}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(a)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    href={`/accounts/${a._id}/ledger`}
                    className="p-1 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 inline-block"
                    title="Ledger"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Current Balance:</span>
                <span className="text-xl font-black text-emerald-400">
                  ৳{a.currentBalance.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editTarget ? 'Edit Financial Account' : 'Add New Account'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. City Bank Current A/C, bKash Merchant"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="BANK">Bank Account</option>
                  <option value="CASH">Cash Drawer / Petty Cash</option>
                  <option value="MFS">Mobile Financial Service (MFS: bKash / Nagad)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account / Wallet Number (Optional)
                </label>
                <input
                  type="text"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="e.g. 150293849102 or 017xxxxxxxx"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {!editTarget && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Opening Initial Balance (৳)
                  </label>
                  <input
                    type="number"
                    value={formInitial}
                    onChange={(e) => setFormInitial(Number(e.target.value))}
                    min={0}
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                disabled={formSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-teal-600/20"
              >
                {formSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Transfer Funds Between Accounts</h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {transferError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Source Account (Debit From)
                </label>
                <select
                  value={fromAccount}
                  onChange={(e) => setFromAccount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                >
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} (৳{a.currentBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination Account (Credit To)
                </label>
                <select
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                >
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} (৳{a.currentBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transfer Amount (৳) *
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  min={1}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-base focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  placeholder="e.g. Cash deposit to bank, MFS balance withdraw"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-teal-600/20"
              >
                {transferSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                )}
                <span>Execute Transfer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Ledger Drawer Modal */}
      {showLedgerModal && selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Account Transaction Ledger</h2>
                <p className="text-xs text-slate-400">
                  {selectedAccount.name} • Current Balance: ৳{selectedAccount.currentBalance.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingLedger ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
                  Loading transactions...
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No transactions recorded for this account.
                </div>
              ) : (
                <div className="space-y-3">
                  {ledgerEntries.map((e) => (
                    <div
                      key={e._id}
                      className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{e.description}</div>
                        <div className="text-slate-400 mt-0.5">
                          {new Date(e.createdAt).toLocaleString()} • Ref: {e.referenceType}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-bold text-sm ${
                            e.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {e.type === 'CREDIT' ? `+৳${e.amount.toFixed(2)}` : `-৳${e.amount.toFixed(2)}`}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          Balance: ৳{e.balanceAfter.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
