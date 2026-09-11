'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api-client';
import { ArrowDownCircle, ArrowUpCircle, AlertCircle, Wallet } from 'lucide-react';

interface PettyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shiftId: string | null;
}

export const PettyCashModal: React.FC<PettyCashModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shiftId,
}) => {
  const toast = useToast();
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!shiftId) {
      setError('No active shift found.');
      return;
    }
    if (amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason/description is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/shifts/${shiftId}/petty-cash`, {
        type,
        amount: Number(amount),
        reason: reason.trim(),
      });
      toast.success(
        type === 'IN' ? 'Petty Cash In' : 'Petty Cash Out',
        `৳${amount} ${type === 'IN' ? 'added to' : 'removed from'} drawer. Reason: ${reason}`
      );
      setAmount(0);
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record petty cash transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <Wallet className="w-5 h-5 text-blue-400" />
          </div>
          <span>Petty Cash Transaction</span>
        </div>
      }
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Type Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Transaction Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('IN')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                type === 'IN'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ArrowDownCircle className="w-6 h-6" />
              <span className="text-sm font-medium">Cash In</span>
              <span className="text-xs opacity-70">Add money to drawer</span>
            </button>

            <button
              type="button"
              onClick={() => setType('OUT')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                type === 'OUT'
                  ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ArrowUpCircle className="w-6 h-6" />
              <span className="text-sm font-medium">Cash Out</span>
              <span className="text-xs opacity-70">Remove money from drawer</span>
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Amount (৳)
          </label>
          <Input
            type="number"
            min={0.01}
            step="0.01"
            placeholder="0.00"
            value={amount || ''}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Reason / Description <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              type === 'IN'
                ? 'e.g. Cash deposit, initial change float addition...'
                : 'e.g. Utility bill payment, supplier advance, miscellaneous...'
            }
            rows={3}
            required
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={type === 'IN' ? 'success' : 'danger'}
            isLoading={submitting}
          >
            Record {type === 'IN' ? 'Cash In' : 'Cash Out'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
