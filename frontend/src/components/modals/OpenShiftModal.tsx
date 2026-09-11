'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api-client';
import { Monitor, DollarSign, AlertCircle } from 'lucide-react';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (shift: any) => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [terminalId, setTerminalId] = useState('POS-01');
  const [openingFloat, setOpeningFloat] = useState<number>(5000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!terminalId.trim()) {
      setError('Terminal ID is required.');
      return;
    }
    if (openingFloat < 0) {
      setError('Opening float cannot be negative.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/shifts/open', {
        terminalId: terminalId.trim(),
        openingFloat: Number(openingFloat) || 0,
      });
      toast.success('Shift Opened', `Shift started on ${terminalId} with ৳${openingFloat} float.`);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to open shift. Please try again.');
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
          <div className="p-1.5 bg-emerald-500/10 rounded-lg">
            <Monitor className="w-5 h-5 text-emerald-400" />
          </div>
          <span>Open Shift</span>
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

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <p className="text-xs text-emerald-400 font-medium mb-1">Ready to start selling?</p>
          <p className="text-xs text-slate-400">
            Set your terminal ID and count the opening cash float in your drawer before opening the shift.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-slate-400" />
            Terminal / Counter ID
          </label>
          <Input
            placeholder="e.g. POS-01, COUNTER-A"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Identifies this point-of-sale terminal (e.g., &quot;POS-01&quot;, &quot;MAIN-COUNTER&quot;)
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            Opening Float (৳)
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
          />
          <p className="text-xs text-slate-500 mt-1">
            Count the cash in your drawer and enter the exact amount before starting.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="success" isLoading={submitting}>
            Open Shift
          </Button>
        </div>
      </form>
    </Modal>
  );
};
