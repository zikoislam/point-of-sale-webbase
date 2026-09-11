'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { api } from '../../lib/api-client';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { DollarSign } from 'lucide-react';

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier: {
    id: string;
    companyName: string;
    currentPayableBalance: number;
  } | null;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  supplier,
}) => {
  const toast = useToast();
  const [amount, setAmount] = useState<number>(0);
  const [accounts, setAccounts] = useState<Array<{ value: string; label: string; balance: number }>>([]);
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !supplier) return;

    setAmount(supplier.currentPayableBalance || 0);
    setNotes('');
    setError('');

    // Fetch accounts
    api.get('/accounts')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const mapped = list.map((a: any) => ({
          value: a.id || a._id,
          label: `${a.name} (${a.accountType}) — Bal: ${formatCurrency(a.currentBalance || 0)}`,
          balance: a.currentBalance || 0,
        }));
        setAccounts(mapped);
        if (mapped.length > 0) {
          setAccountId(mapped[0].value);
        }
      })
      .catch((err) => console.error('Failed to load accounts:', err));
  }, [isOpen, supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    if (amount <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }
    if (amount > supplier.currentPayableBalance) {
      setError(`Amount cannot exceed current payable balance of ${formatCurrency(supplier.currentPayableBalance)}.`);
      return;
    }
    if (!accountId) {
      setError('Please select a payment account.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.post(`/suppliers/${supplier.id}/pay-due`, {
        amount,
        accountId,
        notes: notes.trim() || undefined,
      });

      toast.success(`Disbursed ${formatCurrency(amount)} to ${supplier.companyName} successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment disbursal failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!supplier) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Disburse Vendor Payment"
      subtitle={`${supplier.companyName} • Due: ${formatCurrency(supplier.currentPayableBalance)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Payment Amount (৳) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={supplier.currentPayableBalance}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="w-full h-10 px-3.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <Select
          label="Disburse From Account"
          options={accounts}
          value={accountId}
          onChange={(val) => setAccountId(String(val))}
          required
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Notes / Reference
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bank Cheque #10492 or Bank Transfer TrxID"
            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            loading={saving}
            leftIcon={<DollarSign className="w-4 h-4" />}
          >
            Disburse {formatCurrency(amount)}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
