'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Award,
  DollarSign,
  History,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface Customer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit: number;
  currentDueBalance: number;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: string;
}

interface LedgerEntry {
  _id: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  narration: string;
  recordedById?: { name: string };
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCreditLimit, setFormCreditLimit] = useState(5000);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Payment State
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD'>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`${API}/customers?${params.toString()}`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        let list: Customer[] = j.data.data || [];
        if (filterDueOnly) list = list.filter((c) => c.currentDueBalance > 0);
        setCustomers(list);
      }
    } finally {
      setLoading(false);
    }
  }, [search, filterDueOnly]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openCreateModal = () => {
    setEditTarget(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCreditLimit(5000);
    setFormError('');
    setShowCreateModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditTarget(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormCreditLimit(c.creditLimit || 0);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleSaveCustomer = async () => {
    if (!formName.trim()) {
      setFormError('Customer name is required');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Phone number is required');
      return;
    }

    setFormSaving(true);
    setFormError('');

    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        creditLimit: Number(formCreditLimit) || 0,
      };

      const url = editTarget ? `${API}/customers/${editTarget._id}` : `${API}/customers`;
      const method = editTarget ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to save customer');

      setShowCreateModal(false);
      fetchCustomers();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const openPayModal = (c: Customer) => {
    setPaymentCustomer(c);
    setPayAmount(c.currentDueBalance);
    setPayMethod('CASH');
    setPayNotes('');
    setPayError('');
    setShowPaymentModal(true);
  };

  const handlePayDue = async () => {
    if (!paymentCustomer) return;
    if (payAmount <= 0) {
      setPayError('Amount must be greater than 0');
      return;
    }
    if (payAmount > paymentCustomer.currentDueBalance) {
      setPayError(`Amount exceeds current due balance of ৳${paymentCustomer.currentDueBalance}`);
      return;
    }

    setPaySaving(true);
    setPayError('');

    try {
      const res = await fetch(`${API}/customers/${paymentCustomer._id}/pay-due`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod,
          notes: payNotes.trim() || undefined,
        }),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Payment collection failed');

      setShowPaymentModal(false);
      fetchCustomers();
    } catch (e: any) {
      setPayError(e.message);
    } finally {
      setPaySaving(false);
    }
  };

  const openLedger = async (c: Customer) => {
    setLedgerCustomer(c);
    setShowLedgerModal(true);
    setLoadingLedger(true);

    try {
      const res = await fetch(`${API}/customers/${c._id}/ledger`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        setLedgerEntries(j.data.data || []);
      }
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (c.currentDueBalance > 0) {
      alert(`Cannot delete customer with active outstanding balance of ৳${c.currentDueBalance}`);
      return;
    }
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    try {
      const res = await fetch(`${API}/customers/${c._id}`, { method: 'DELETE', headers: authHeader() });
      const j = await res.json();
      if (j.success) fetchCustomers();
      else alert(j.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Customer CRM & Credit Ledger</h1>
            <p className="text-sm text-slate-400">
              Manage loyalty profiles, store credit limits & track due payment collections
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchCustomers()}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition shadow-lg shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <button
          onClick={() => setFilterDueOnly(!filterDueOnly)}
          className={`px-4 py-2 rounded-lg text-xs font-bold border transition flex items-center space-x-2 ${
            filterDueOnly
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Show Customers with Due Balance Only</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Phone / Contact</th>
                <th className="py-3.5 px-4 text-right">Credit Limit</th>
                <th className="py-3.5 px-4 text-right">Current Due</th>
                <th className="py-3.5 px-4 text-center">Loyalty Points</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No customers found matching search criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{c.name}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{c.address || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-200 flex items-center space-x-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                      {c.email && (
                        <div className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      ৳{c.creditLimit?.toFixed(2) || '0.00'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      <span className={c.currentDueBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        ৳{c.currentDueBalance?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <Award className="w-3 h-3 text-amber-400" />
                        <span>{c.loyaltyPoints || 0} pts</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {c.currentDueBalance > 0 && (
                          <button
                            onClick={() => openPayModal(c)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition"
                          >
                            Collect Due
                          </button>
                        )}
                        <button
                          onClick={() => openLedger(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                          title="View Ledger"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editTarget ? 'Edit Customer Profile' : 'Add New Customer'}
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="018xxxxxxxx"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Credit Limit (৳)
                </label>
                <input
                  type="number"
                  value={formCreditLimit}
                  onChange={(e) => setFormCreditLimit(Number(e.target.value))}
                  min={0}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Max allowed credit balance at POS checkout before cashier override.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street, City, Area"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
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
                onClick={handleSaveCustomer}
                disabled={formSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-cyan-600/20"
              >
                {formSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Due Payment Modal */}
      {showPaymentModal && paymentCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Collect Due Payment</h2>
                <p className="text-xs text-slate-400">
                  {paymentCustomer.name} • Due: ৳{paymentCustomer.currentDueBalance.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {payError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {payError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Collection Amount (৳) *
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  min={1}
                  max={paymentCustomer.currentDueBalance}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Tender Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH">Cash (Adds to Drawer)</option>
                  <option value="MFS_BKASH">bKash</option>
                  <option value="MFS_NAGAD">Nagad</option>
                  <option value="CARD">Bank Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Receipt / Transaction Note
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="TxID or check number"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayDue}
                disabled={paySaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20"
              >
                {paySaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Record Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Ledger Drawer Modal */}
      {showLedgerModal && ledgerCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Customer Credit History & Ledger</h2>
                <p className="text-xs text-slate-400">
                  {ledgerCustomer.name} ({ledgerCustomer.phone}) • Current Due: ৳{ledgerCustomer.currentDueBalance.toFixed(2)}
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
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                  Loading transactions...
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No credit transactions recorded for this customer.
                </div>
              ) : (
                <div className="space-y-3">
                  {ledgerEntries.map((e) => (
                    <div
                      key={e._id}
                      className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{e.narration}</div>
                        <div className="text-slate-400 mt-0.5">
                          {new Date(e.createdAt).toLocaleString()} • Type: {e.transactionType}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-bold text-sm ${
                            e.transactionType === 'SALE_DUE' ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {e.transactionType === 'SALE_DUE' ? `+৳${e.amount.toFixed(2)}` : `-৳${e.amount.toFixed(2)}`}
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
