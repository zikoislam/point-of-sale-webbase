'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Warehouse,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { ReportTable, money } from '../../../../components/reports/ReportShell';

interface PendingItem {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  unitCost: number;
}

interface PendingPurchase {
  id: string;
  poNumber: string;
  supplierName: string;
  branchName: string | null;
  status: string;
  approvalStatus?: string;
  itemsCount: number;
  pendingQty: number;
  totalAmount: number;
  pendingValue: number;
  orderedItems: PendingItem[];
  createdAt: string;
  expectedDeliveryDate?: string;
  waitingDays: number;
}

/**
 * Manual Purchase Receive.
 *
 * Lists every purchase whose goods have not arrived yet and books the whole
 * order in with one confirmation — the shop receives manual purchases in full,
 * so there is no partial-quantity entry here (the classic GRN modal still
 * exists on the purchase order itself for the rare partial case).
 */
export default function PurchaseReceivePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<PendingPurchase | null>(null);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['pending-receive'],
    queryFn: async () => (await api.get('/purchase-orders/pending-receive')).data,
  });

  const receiveMutation = useMutation({
    mutationFn: async (po: PendingPurchase) =>
      api.post(`/purchase-orders/${po.id}/receive-full`, {
        vendorInvoiceNo: vendorInvoiceNo || undefined,
        paidNow: paidNow ? Number(paidNow) : undefined,
      }),
    onSuccess: (res: any) => {
      setLastReceipt(res.data);
      setTarget(null);
      setVendorInvoiceNo('');
      setPaidNow('');
      qc.invalidateQueries({ queryKey: ['pending-receive'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(res.message || 'Purchase received');
    },
    onError: (e: any) => toast.error(e?.message || 'Could not receive this purchase'),
  });

  const rows: PendingPurchase[] = (data?.data || []).filter((p: PendingPurchase) =>
    !search.trim() ||
    p.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  const summary = data?.summary;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
            <PackageCheck className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Purchase Receive</h1>
            <p className="text-xs text-slate-400">
              Confirm the goods you received — the whole purchase is booked into stock in one action
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Pending Purchases" value={String(summary?.purchases ?? 0)} tone="indigo" />
        <KpiCard label="Units To Receive" value={String(summary?.pendingQty ?? 0)} tone="white" />
        <KpiCard label="Value To Receive" value={money(summary?.pendingValue)} tone="amber" />
        <KpiCard
          label="Waiting Over A Week"
          value={String(summary?.overdueDays ?? 0)}
          tone="rose"
          hint="Chase the supplier"
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by PO number or supplier"
          className="pl-9"
        />
      </div>

      <ReportTable
        headers={[
          { label: 'Purchase' },
          { label: 'Supplier' },
          { label: 'Branch / Warehouse' },
          { label: 'Items', align: 'right' },
          { label: 'Pending Qty', align: 'right' },
          { label: 'Value', align: 'right' },
          { label: 'Waiting', align: 'center' },
          { label: 'Status', align: 'center' },
          { label: 'Action', align: 'right' },
        ]}
        isEmpty={!isLoading && rows.length === 0}
        empty="Nothing waiting to be received — every purchase is booked in."
      >
        {rows.map((po) => (
          <tr key={po.id} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4">
              <span className="font-mono text-[11px] text-white">{po.poNumber}</span>
              <span className="block text-[10px] text-slate-500">
                {new Date(po.createdAt).toLocaleDateString()}
              </span>
            </td>
            <td className="py-2.5 px-4 text-slate-300">{po.supplierName}</td>
            <td className="py-2.5 px-4 text-slate-400">
              {po.branchName ? (
                <span className="inline-flex items-center gap-1">
                  <Warehouse className="w-3.5 h-3.5" />
                  {po.branchName}
                </span>
              ) : (
                <span className="text-slate-500">Head office / org-wide</span>
              )}
            </td>
            <td className="py-2.5 px-4 text-right text-slate-300">{po.itemsCount}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{po.pendingQty}</td>
            <td className="py-2.5 px-4 text-right text-amber-400">{money(po.pendingValue)}</td>
            <td className="py-2.5 px-4 text-center">
              <span className={po.waitingDays > 7 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                {po.waitingDays}d
              </span>
              {po.expectedDeliveryDate && (
                <span className="block text-[10px] text-slate-500 inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  due {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                </span>
              )}
            </td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={po.status === 'PARTIAL' ? 'warning' : po.status === 'DRAFT' ? 'neutral' : 'info'}>
                {po.status === 'DRAFT' ? 'Not ordered yet' : po.status === 'PARTIAL' ? 'Partially received' : 'Ordered'}
              </Badge>
            </td>
            <td className="py-2.5 px-4 text-right">
              <button
                onClick={() => {
                  setTarget(po);
                  setPaidNow('');
                  setVendorInvoiceNo('');
                }}
                className="px-2.5 py-1 rounded text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1"
              >
                <PackageCheck className="w-3 h-3" /> Receive all
              </button>
            </td>
          </tr>
        ))}
      </ReportTable>

      {/* Confirmation: full receive */}
      <Modal
        isOpen={!!target}
        onClose={() => setTarget(null)}
        title={`Receive ${target?.poNumber || ''}`}
        size="lg"
      >
        {target && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 p-3 text-xs space-y-1">
              <div className="flex justify-between text-white font-semibold">
                <span>{target.supplierName}</span>
                <span>
                  {target.branchName ? `Into ${target.branchName}` : 'Into the organization stock'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Purchase value</span>
                <span>{money(target.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold pt-1 border-t border-slate-800">
                <span>Being received now</span>
                <span>
                  {target.pendingQty} unit(s) · {money(target.pendingValue)}
                </span>
              </div>
            </div>

            <ReportTable
              headers={[
                { label: 'Item' },
                { label: 'SKU' },
                { label: 'Ordered', align: 'right' },
                { label: 'Already received', align: 'right' },
                { label: 'Receiving now', align: 'right' },
                { label: 'Unit cost', align: 'right' },
              ]}
              isEmpty={target.orderedItems.length === 0}
            >
              {target.orderedItems.map((i) => (
                <tr key={i.variantId} className={i.pendingQty === 0 ? 'opacity-40' : ''}>
                  <td className="py-2 px-4 text-white">{i.productName}</td>
                  <td className="py-2 px-4 text-slate-500 font-mono text-[11px]">{i.sku}</td>
                  <td className="py-2 px-4 text-right text-slate-300">{i.orderedQty}</td>
                  <td className="py-2 px-4 text-right text-slate-400">{i.receivedQty}</td>
                  <td className="py-2 px-4 text-right text-emerald-400 font-semibold">{i.pendingQty}</td>
                  <td className="py-2 px-4 text-right text-slate-300">{money(i.unitCost)}</td>
                </tr>
              ))}
            </ReportTable>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Vendor invoice no. (optional)</label>
                <Input value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="e.g. INV-2291" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Paid now (optional)</label>
                <Input
                  type="number"
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  placeholder="0.00"
                />
                {Number(paidNow) > target.pendingValue && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    More than the received value — it will be capped at {money(target.pendingValue)}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-[11px] text-orange-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                The entire outstanding quantity will be received at once: stock, weighted-average cost, the supplier
                ledger balance and the accounting journal are all posted together. This cannot be undone from here.
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button onClick={() => receiveMutation.mutate(target)} disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? 'Receiving…' : 'Confirm receipt'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt confirmation */}
      <Modal isOpen={!!lastReceipt} onClose={() => setLastReceipt(null)} title="Purchase received">
        {lastReceipt && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-200">
                <p className="font-semibold text-emerald-300">
                  {lastReceipt.purchaseOrder?.poNumber} → {lastReceipt.status}
                </p>
                <p className="mt-0.5">
                  {lastReceipt.receivedQty} unit(s) across {lastReceipt.receivedItems} line(s) added to stock.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Paid on this receipt</span>
                <span>{money(lastReceipt.purchaseOrder?.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Still due to the supplier</span>
                <span className="text-rose-400">{money(lastReceipt.purchaseOrder?.dueAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Received on</span>
                <span>
                  {lastReceipt.purchaseOrder?.actualReceivedDate
                    ? new Date(lastReceipt.purchaseOrder.actualReceivedDate).toLocaleString()
                    : '—'}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLastReceipt(null)}>
                Close
              </Button>
              <a
                href={`/purchase-orders`}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
              >
                <Truck className="w-3.5 h-3.5 mr-1.5" /> All purchase orders
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
