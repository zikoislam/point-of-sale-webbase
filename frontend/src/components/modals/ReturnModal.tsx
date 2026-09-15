'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { api } from '../../lib/api-client';
import { formatCurrency } from '../../lib/utils';
import { RotateCcw, AlertCircle, Check, Ticket } from 'lucide-react';

interface ReturnItemState {
  variantId: string;
  productName: string;
  soldQty: number;
  returnQty: number;
  unitRefundPrice: number;
  isResaleable: boolean;
}

interface ReturnModalProps {
  sale: {
    _id: string;
    invoiceNo: string;
    totalAmount: number;
    subtotal: number;
    discountAmount: number;
    customerId?: { _id: string; name: string };
    items: Array<{
      variantId: string;
      productName: string;
      variantName?: string;
      quantity: number;
      unitSellingPrice: number;
      discount?: number;
    }>;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReturnModal({ sale, onClose, onSuccess }: ReturnModalProps) {
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>(
    sale.items.map((i) => {
      // Proportional discount formula: Refund = Price - (Price * (Discount / Subtotal))
      const discountRatio = sale.subtotal > 0 ? (sale.discountAmount || 0) / sale.subtotal : 0;
      const unitRefundPrice = Math.max(0, i.unitSellingPrice * (1 - discountRatio));

      return {
        variantId: i.variantId,
        productName: `${i.productName} ${i.variantName ? `(${i.variantName})` : ''}`.trim(),
        soldQty: i.quantity,
        returnQty: 0,
        unitRefundPrice: Number(unitRefundPrice.toFixed(2)),
        isResaleable: true,
      };
    })
  );

  const [refundType, setRefundType] = useState<'CASH' | 'STORE_CREDIT'>(
    sale.customerId ? 'STORE_CREDIT' : 'CASH'
  );
  const [returnReason, setReturnReason] = useState('Customer return');
  const [managerPin, setManagerPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [completedVoucher, setCompletedVoucher] = useState<any>(null);

  const totalRefundAmount = returnItems.reduce(
    (acc, i) => acc + (Number(i.returnQty) || 0) * (Number(i.unitRefundPrice) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeReturns = returnItems.filter((i) => i.returnQty > 0);
    if (activeReturns.length === 0) {
      setError('Please enter return quantity > 0 for at least one item');
      return;
    }
    if (!returnReason.trim()) {
      setError('Please provide a reason for return');
      return;
    }
    if (!/^\d{4,}$/.test(managerPin.trim())) {
      setError('Manager PIN (min 4 digits) is required to authorise a return');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        saleId: sale._id,
        items: activeReturns.map((i) => ({
          variantId: i.variantId,
          quantity: i.returnQty,
          unitRefundPrice: i.unitRefundPrice,
          isResaleable: i.isResaleable,
        })),
        refundType,
        reason: returnReason.trim(),
        managerPin: managerPin.trim(),
      };

      const res = await api.post('/returns', payload);
      if (res.data?.voucher) {
        setCompletedVoucher(res.data.voucher);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process return');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-rose-400" />
          <span>Process Sales Return — {sale.invoiceNo}</span>
        </div>
      }
      size="xl"
    >
      {completedVoucher ? (
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <Ticket className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Return Processed Successfully</h3>
          <p className="text-sm text-slate-400">
            A Store Credit Voucher has been generated for the customer.
          </p>
          <div className="p-4 bg-slate-800 rounded-xl max-w-sm mx-auto border border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold">Voucher Code</div>
            <div className="text-2xl font-mono font-black text-amber-400 mt-1">
              {completedVoucher.code}
            </div>
            <div className="text-sm font-semibold text-emerald-400 mt-1">
              Value: {formatCurrency(completedVoucher.balance || totalRefundAmount)}
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              onSuccess?.();
            }}
          >
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Items selection */}
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            <label className="block text-xs font-bold text-slate-300 uppercase">
              Select Return Quantities
            </label>
            {returnItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{item.productName}</span>
                  <span className="text-slate-400">Sold: {item.soldQty}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Return Qty (Max {item.soldQty})
                    </label>
                    <NumberInput
                      value={item.returnQty}
                      onValueChange={(v) => {
                        const updated = [...returnItems];
                        updated[idx].returnQty = Math.min(item.soldQty, Math.max(0, v));
                        setReturnItems(updated);
                      }}
                      allowDecimal={false}
                      min={0}
                      max={item.soldQty}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Unit Refund (৳)
                    </label>
                    <input
                      type="number"
                      value={item.unitRefundPrice}
                      readOnly
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Restock Condition
                    </label>
                    <select
                      value={item.isResaleable ? 'YES' : 'NO'}
                      onChange={(e) => {
                        const updated = [...returnItems];
                        updated[idx].isResaleable = e.target.value === 'YES';
                        setReturnItems(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="YES">Resaleable (Restock)</option>
                      <option value="NO">Damaged (Wastage)</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Refund Disbursement
              </label>
              <select
                value={refundType}
                onChange={(e) => setRefundType(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
              >
                <option value="CASH">Cash Refund (Deduct from Register)</option>
                <option value="STORE_CREDIT">Store Credit Voucher</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Manager PIN *
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Return *
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Reason..."
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Refund:</span>
            <span className="text-xl font-black text-rose-400">
              {formatCurrency(totalRefundAmount)}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              loading={saving}
              disabled={totalRefundAmount <= 0}
            >
              Confirm & Process Return
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
