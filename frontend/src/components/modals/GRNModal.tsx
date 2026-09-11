'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { api } from '../../lib/api-client';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { CheckCircle2, PackageCheck, AlertCircle, Calendar, Hash } from 'lucide-react';

export interface GRNLineItem {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  alreadyReceived: number;
  receivingNow: number;
  unitCost: number;
  batchNo?: string;
  expiryDate?: string;
}

interface GRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  po: {
    _id: string;
    poNumber: string;
    supplierId?: { _id: string; companyName: string };
    items: Array<{
      variantId: string;
      productName: string;
      sku: string;
      orderedQty: number;
      receivedQty: number;
      unitCost: number;
    }>;
    totalAmount: number;
    dueAmount: number;
  } | null;
}

export const GRNModal: React.FC<GRNModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  po,
}) => {
  const toast = useToast();
  const [items, setItems] = useState<GRNLineItem[]>([]);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paidNow, setPaidNow] = useState<number>(0);
  const [accounts, setAccounts] = useState<Array<{ value: string; label: string; balance: number }>>([]);
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !po) return;

    // Initialize line items with receiving now = remaining
    const mapped: GRNLineItem[] = (po.items || []).map((item) => {
      const remaining = Math.max(0, item.orderedQty - (item.receivedQty || 0));
      return {
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        orderedQty: item.orderedQty,
        alreadyReceived: item.receivedQty || 0,
        receivingNow: remaining,
        unitCost: item.unitCost,
        batchNo: '',
        expiryDate: '',
      };
    });

    setItems(mapped);
    setVendorInvoiceNo('');
    setPaidNow(0);
    setError('');

    // Load payment accounts
    api.get('/accounts')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const mappedAcc = list.map((a: any) => ({
          value: a.id || a._id,
          label: `${a.name} (${a.accountType}) — Bal: ${formatCurrency(a.currentBalance || 0)}`,
          balance: a.currentBalance || 0,
        }));
        setAccounts(mappedAcc);
        if (mappedAcc.length > 0) {
          setAccountId(mappedAcc[0].value);
        }
      })
      .catch(() => {});
  }, [isOpen, po]);

  const handleQtyChange = (index: number, val: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const maxQty = Math.max(0, copy[index].orderedQty - copy[index].alreadyReceived);
      const clamped = Math.min(Math.max(0, val || 0), maxQty);
      copy[index] = { ...copy[index], receivingNow: clamped };
      return copy;
    });
  };

  const handleFieldChange = (index: number, field: keyof GRNLineItem, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const totalReceivingValue = items.reduce(
    (sum, item) => sum + item.receivingNow * item.unitCost,
    0
  );

  const totalReceivingQty = items.reduce(
    (sum, item) => sum + item.receivingNow,
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;

    if (totalReceivingQty <= 0) {
      setError('Please enter a receiving quantity of at least 1 for one or more items.');
      return;
    }

    if (paidNow > 0 && !accountId && accounts.length > 0) {
      setError('Please select a payment account for immediate payment.');
      return;
    }

    const selectedAcc = accounts.find((a) => a.value === accountId);
    if (paidNow > 0 && selectedAcc && selectedAcc.balance < paidNow) {
      setError(`Insufficient balance in account (${formatCurrency(selectedAcc.balance)}).`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        vendorInvoiceNo: vendorInvoiceNo.trim() || undefined,
        paidNow: Number(paidNow) || 0,
        accountId: paidNow > 0 ? accountId : undefined,
        items: items
          .filter((i) => i.receivingNow > 0)
          .map((i) => ({
            variantId: i.variantId,
            receivedQty: i.receivingNow,
            unitCost: i.unitCost,
            batchNo: i.batchNo?.trim() || undefined,
            expiryDate: i.expiryDate || undefined,
          })),
      };

      await api.post(`/purchase-orders/${po._id}/receive`, payload);

      toast.success(
        'Stock Updated Successfully',
        `Goods received for ${po.poNumber}. Inventory stock updated!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to receive goods. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Goods (GRN) — ${po?.poNumber || ''}`}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
          <div>
            <p className="text-xs text-slate-400">Supplier</p>
            <p className="text-sm font-medium text-slate-200">
              {po?.supplierId?.companyName || 'Unknown Supplier'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total PO Value</p>
            <p className="text-sm font-semibold text-slate-100">
              {formatCurrency(po?.totalAmount || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Receiving Value Now</p>
            <p className="text-sm font-bold text-emerald-400">
              {formatCurrency(totalReceivingValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Items Receiving</p>
            <p className="text-sm font-semibold text-blue-400">
              {totalReceivingQty} units
            </p>
          </div>
        </div>

        {/* Line Items Receiving Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-300">
              Line Items to Receive
            </h4>
            <span className="text-xs text-slate-500">
              Max receiving qty clamped to remaining ordered qty
            </span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-800/60">
              {items.map((item, idx) => {
                const remaining = Math.max(0, item.orderedQty - item.alreadyReceived);
                const isFullyReceived = remaining === 0;

                return (
                  <div
                    key={item.variantId || idx}
                    className={`p-3.5 space-y-3 transition-colors ${
                      isFullyReceived ? 'bg-slate-900/20 opacity-60' : 'hover:bg-slate-850/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {item.productName}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          SKU: {item.sku}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            isFullyReceived
                              ? 'success'
                              : item.alreadyReceived > 0
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {item.alreadyReceived} / {item.orderedQty} received
                        </Badge>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Rem: <span className="font-semibold text-slate-200">{remaining}</span>
                        </p>
                      </div>
                    </div>

                    {!isFullyReceived && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Receiving Now (Max: {remaining})
                          </label>
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={item.receivingNow}
                            onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-slate-500" />
                            Batch No (Optional)
                          </label>
                          <Input
                            placeholder="e.g. BATCH-2026-A"
                            value={item.batchNo || ''}
                            onChange={(e) => handleFieldChange(idx, 'batchNo', e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            Expiry Date (FEFO)
                          </label>
                          <Input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => handleFieldChange(idx, 'expiryDate', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Invoice & Payment Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Vendor Invoice Number (Optional)
            </label>
            <Input
              placeholder="e.g. INV-SUP-98231"
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Pay Now to Supplier (Optional)
            </label>
            <Input
              type="number"
              min={0}
              max={totalReceivingValue}
              value={paidNow || ''}
              placeholder="0.00"
              onChange={(e) => setPaidNow(parseFloat(e.target.value) || 0)}
              className="h-9 text-sm font-medium"
            />
          </div>

          {paidNow > 0 && (
            <div className="sm:col-span-2 pt-1">
              <Select
                label="Disburse From Financial Account"
                value={accountId}
                onChange={(val) => setAccountId(String(val))}
                options={accounts}
                required
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            leftIcon={<PackageCheck className="w-4 h-4" />}
            disabled={totalReceivingQty <= 0}
          >
            Receive & Update Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
};
