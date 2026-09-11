'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api-client';
import { formatCurrency } from '../../lib/utils';
import { Lock, AlertCircle, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: {
    _id: string;
    terminalId: string;
    openingFloat: number;
    cashSalesTotal: number;
    cashExpensesTotal: number;
    pettyCashIn: number;
    pettyCashOut: number;
    expectedCash: number;
  } | null;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shift,
}) => {
  const toast = useToast();
  const [actualCash, setActualCash] = useState<number>(0);
  const [managerPin, setManagerPin] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!shift) return null;

  const expectedCash = shift.openingFloat + shift.cashSalesTotal - shift.cashExpensesTotal + shift.pettyCashIn - shift.pettyCashOut;
  const discrepancy = actualCash - expectedCash;
  const absDiscrepancy = Math.abs(discrepancy);
  const requiresManagerPin = absDiscrepancy > 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (requiresManagerPin && !managerPin.trim()) {
      setError('Manager PIN is required when discrepancy exceeds ৳10.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/shifts/${shift._id}/close`, {
        actualCash: Number(actualCash) || 0,
        managerPin: managerPin.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Shift Closed', `Shift on ${shift.terminalId} has been closed successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to close shift.');
    } finally {
      setSubmitting(false);
    }
  };

  const discrepancyColor =
    discrepancy === 0
      ? 'text-emerald-400'
      : discrepancy > 0
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-rose-500/10 rounded-lg">
            <Lock className="w-5 h-5 text-rose-400" />
          </div>
          <span>Close Shift — {shift.terminalId}</span>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cash Breakdown Summary */}
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Cash Drawer Summary
            </p>
          </div>
          <div className="p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Opening Float:</span>
              <span className="font-medium text-slate-200">{formatCurrency(shift.openingFloat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">+ Cash Sales:</span>
              <span className="font-medium text-emerald-400">+{formatCurrency(shift.cashSalesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">+ Petty Cash In:</span>
              <span className="font-medium text-emerald-400">+{formatCurrency(shift.pettyCashIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">− Cash Expenses:</span>
              <span className="font-medium text-rose-400">−{formatCurrency(shift.cashExpensesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">− Petty Cash Out:</span>
              <span className="font-medium text-rose-400">−{formatCurrency(shift.pettyCashOut)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-800">
              <span className="font-semibold text-slate-200">Expected Cash:</span>
              <span className="font-bold text-blue-400">{formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        {/* Actual Cash Input */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Actual Cash Counted (৳)
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Count physical cash in drawer..."
            value={actualCash || ''}
            onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Count all cash in the drawer and enter the exact amount.
          </p>
        </div>

        {/* Discrepancy Display */}
        {actualCash > 0 && (
          <div className={`p-4 rounded-xl border ${
            discrepancy === 0
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : discrepancy > 0
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {discrepancy === 0 ? (
                  <Minus className="w-4 h-4 text-emerald-400" />
                ) : discrepancy > 0 ? (
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className="text-sm font-medium text-slate-200">
                  Cash Discrepancy
                </span>
              </div>
              <span className={`text-lg font-bold ${discrepancyColor}`}>
                {discrepancy >= 0 ? '+' : ''}{formatCurrency(discrepancy)}
              </span>
            </div>
            {discrepancy !== 0 && (
              <p className={`text-xs mt-1.5 ${discrepancyColor} opacity-80`}>
                {discrepancy > 0
                  ? 'Surplus: More cash than expected in drawer.'
                  : 'Shortage: Less cash than expected in drawer.'}
                {requiresManagerPin && ' Manager approval required.'}
              </p>
            )}
          </div>
        )}

        {/* Manager PIN (if discrepancy > 10) */}
        {requiresManagerPin && (
          <div>
            <label className="block text-xs font-medium text-amber-300 mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Manager PIN Required (Discrepancy exceeds ৳10)
            </label>
            <Input
              type="password"
              placeholder="Enter manager authorization PIN"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              required
              className="border-amber-500/40 focus:border-amber-500"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Shift Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this shift, unusual occurrences, etc."
            rows={2}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={submitting}>
            Close Shift
          </Button>
        </div>
      </form>
    </Modal>
  );
};
