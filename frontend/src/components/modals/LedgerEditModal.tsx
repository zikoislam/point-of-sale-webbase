'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { api } from '../../lib/api-client';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { Edit2 } from 'lucide-react';

export interface LedgerEntryForEdit {
  _id: string;
  transactionType: string;
  amount: number;
  narration: string;
  transactionDate?: string;
  createdAt: string;
}

interface LedgerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string;
  entry: LedgerEntryForEdit | null;
}

const toLocalDateInput = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const LedgerEditModal: React.FC<LedgerEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  entry,
}) => {
  const toast = useToast();
  const [amount, setAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !entry) return;
    setAmount(entry.amount);
    setNarration(entry.narration || '');
    setTransactionDate(toLocalDateInput(entry.transactionDate || entry.createdAt));
    setError('');
  }, [isOpen, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    if (amount < 0) {
      setError('Amount cannot be negative.');
      return;
    }
    if (!transactionDate) {
      setError('Transaction date is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.put(`/customers/${customerId}/ledger/${entry._id}`, {
        amount,
        narration: narration.trim() || undefined,
        transactionDate: new Date(`${transactionDate}T12:00:00.000Z`).toISOString(),
      });

      toast.success('Ledger entry updated successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update ledger entry.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  const typeLabel: Record<string, string> = {
    OPENING: 'Opening Balance',
    SALE_DUE: 'Sale Due',
    PAYMENT_COLLECTION: 'Payment Collection',
    RETURN_CREDIT: 'Return Credit',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Edit Ledger Entry"
      subtitle={`Type: ${typeLabel[entry.transactionType] || entry.transactionType} • Current: ${formatCurrency(entry.amount)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
          ⚠️ Editing this entry will automatically recalculate all subsequent balances and the customer&apos;s current due balance.
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Amount (৳) *
          </label>
          <NumberInput
            min={0}
            value={amount}
            onValueChange={setAmount}
            className="w-full h-10 px-3.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Transaction Date *
          </label>
          <input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            required
            className="w-full h-10 px-3.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Narration / Notes
          </label>
          <textarea
            rows={2}
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Describe the reason for this correction..."
            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            leftIcon={<Edit2 className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
