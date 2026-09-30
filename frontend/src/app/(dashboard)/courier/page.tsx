'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, RefreshCw, PackageCheck, Send, XCircle, Info } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { KpiCard } from '../../../components/reports/KpiCard';
import { ReportTable, money } from '../../../components/reports/ReportShell';

const COURIER_STATUSES = ['PENDING', 'PICKED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'FAILED', 'CANCELLED'];

const statusVariant = (s: string) =>
  s === 'DELIVERED' ? 'success' : s === 'IN_TRANSIT' || s === 'PICKED' ? 'info' : s === 'RETURNED' || s === 'FAILED' ? 'danger' : s === 'CANCELLED' ? 'neutral' : 'warning';

export default function CourierPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [shipOrder, setShipOrder] = useState<any | null>(null);
  const [shipForm, setShipForm] = useState({ provider: 'MANUAL', deliveryFee: '', weightKg: '', note: '', consignmentId: '', trackingCode: '' });
  const [statusTarget, setStatusTarget] = useState<any | null>(null);
  const [statusForm, setStatusForm] = useState({ status: 'IN_TRANSIT', note: '' });

  const { data: providers = [] } = useQuery<any[]>({
    queryKey: ['courier-providers'],
    queryFn: async () => (await api.get('/couriers/providers')).data || [],
  });

  const { data: shipments, isLoading } = useQuery<any>({
    queryKey: ['courier-shipments', statusFilter],
    queryFn: async () =>
      (await api.get('/couriers/shipments', { params: { status: statusFilter || undefined, limit: 100 } })).data,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['courier-stats'],
    queryFn: async () => (await api.get('/couriers/stats')).data,
  });

  const { data: confirmedOrders = [] } = useQuery<any[]>({
    queryKey: ['courier-ready-orders'],
    queryFn: async () => {
      const res = await api.get('/ecommerce/orders', { params: { status: 'CONFIRMED' } });
      // the list endpoint returns a bare array
      return (Array.isArray(res.data) ? res.data : (res.data as any)?.data) || [];
    },
  });

  const shipMutation = useMutation({
    mutationFn: async () =>
      api.post(`/couriers/shipments/${shipOrder._id}`, {
        provider: shipForm.provider,
        deliveryFee: Number(shipForm.deliveryFee) || 0,
        weightKg: shipForm.weightKg ? Number(shipForm.weightKg) : undefined,
        note: shipForm.note || undefined,
        consignmentId: shipForm.consignmentId || undefined,
        trackingCode: shipForm.trackingCode || undefined,
      }),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Shipment created');
      setShipOrder(null);
      setShipForm({ provider: 'MANUAL', deliveryFee: '', weightKg: '', note: '', consignmentId: '', trackingCode: '' });
      qc.invalidateQueries({ queryKey: ['courier-shipments'] });
      qc.invalidateQueries({ queryKey: ['courier-stats'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the shipment'),
  });

  const statusMutation = useMutation({
    mutationFn: async () =>
      api.put(`/couriers/shipments/${statusTarget._id}/status`, { status: statusForm.status, note: statusForm.note || undefined }),
    onSuccess: (res: any) => {
      toast.success(`Courier status → ${res.data?.status}`);
      setStatusTarget(null);
      setStatusForm({ status: 'IN_TRANSIT', note: '' });
      qc.invalidateQueries({ queryKey: ['courier-shipments'] });
      qc.invalidateQueries({ queryKey: ['courier-stats'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not update the shipment'),
  });

  const rows: any[] = shipments?.data || [];
  const summary = shipments?.summary;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30">
            <Truck className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Courier &amp; Delivery</h1>
            <p className="text-xs text-slate-400">
              Hand online orders to Pathao / RedX (or track them manually) and follow every parcel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
          >
            <option value="">All courier statuses</option>
            {COURIER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Provider readiness */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {providers.map((p: any) => (
          <div key={p.provider} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{p.provider}</span>
              <Badge variant={p.mode === 'LIVE' ? 'success' : p.mode === 'MANUAL' ? 'info' : 'warning'}>
                {p.mode.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {p.mode === 'LIVE'
                ? 'Live API dispatch enabled'
                : p.mode === 'MANUAL'
                ? 'Always available — records the parcel and tracking id'
                : 'Add the API keys to switch on live dispatch'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Shipments" value={String(summary?.shipments ?? 0)} tone="indigo" />
        <KpiCard label="In Transit" value={String(summary?.inTransit ?? 0)} tone="amber" />
        <KpiCard label="Delivered" value={String(summary?.delivered ?? 0)} tone="emerald" />
        <KpiCard label="Returned / Failed" value={String(summary?.returnedOrFailed ?? 0)} tone="rose" />
        <KpiCard label="COD Outstanding" value={money(summary?.codOutstanding)} tone="white" hint={`Collected ${money(summary?.codCollected)}`} />
      </div>

      {/* Ready to ship */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-white">Confirmed orders waiting for dispatch ({confirmedOrders.length})</h2>
        </div>
        {confirmedOrders.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing waiting — confirm an online order to ship it.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {confirmedOrders.map((o: any) => (
              <button
                key={o._id}
                onClick={() => setShipOrder(o)}
                className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-left hover:border-teal-500/50"
              >
                <span className="block text-xs font-mono text-white">{o.orderNo}</span>
                <span className="block text-[10px] text-slate-400">
                  {o.customer?.name} · {money(o.totalAmount)} · COD
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <ReportTable
        headers={[
          { label: 'Order' },
          { label: 'Customer' },
          { label: 'Courier' },
          { label: 'Tracking' },
          { label: 'Amount', align: 'right' },
          { label: 'COD', align: 'right' },
          { label: 'Status', align: 'center' },
          { label: 'Actions', align: 'right' },
        ]}
        isEmpty={!isLoading && rows.length === 0}
        empty="No parcel handed to a courier yet."
      >
        {rows.map((r: any) => (
          <tr key={r._id} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4">
              <span className="font-mono text-[11px] text-white">{r.orderNo}</span>
              <span className="block text-[10px] text-slate-500">
                {r.courier?.sentAt ? new Date(r.courier.sentAt).toLocaleDateString() : ''}
              </span>
            </td>
            <td className="py-2.5 px-4 text-slate-300">
              {r.customer?.name}
              <span className="block text-[10px] text-slate-500">{r.customer?.phone}</span>
            </td>
            <td className="py-2.5 px-4">
              <Badge variant="neutral">{r.courier?.provider}</Badge>
              {r.courier?.note ? (
                <span className="block text-[10px] text-amber-400/80 mt-1 max-w-[200px] truncate" title={r.courier.note}>
                  {r.courier.note}
                </span>
              ) : null}
            </td>
            <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{r.courier?.trackingCode || r.trackingCode || '—'}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.totalAmount)}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">
              {r.courier?.codAmount > 0 ? money(r.courier.codAmount) : '—'}
            </td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={statusVariant(r.courier?.status) as any}>{(r.courier?.status || '—').replace('_', ' ')}</Badge>
              <span className="block text-[10px] text-slate-500 mt-1">{r.fulfillmentStatus}</span>
            </td>
            <td className="py-2.5 px-4">
              <div className="flex items-center justify-end gap-1.5">
                {r.courier?.status === 'DELIVERED' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                    <PackageCheck className="w-3 h-3" /> delivered
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setStatusTarget(r);
                      setStatusForm({ status: r.courier?.status === 'PENDING' ? 'PICKED' : 'DELIVERED', note: '' });
                    }}
                    className="px-2 py-1 rounded text-[11px] text-teal-400 hover:bg-slate-800"
                  >
                    Update status
                  </button>
                )}
                {['RETURNED', 'FAILED', 'CANCELLED'].includes(r.courier?.status) && (
                  <button
                    onClick={() => setShipOrder(r)}
                    className="px-2 py-1 rounded text-[11px] text-amber-400 hover:bg-slate-800 inline-flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" /> Re-dispatch
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </ReportTable>

      {/* Couriers can push status without a login — surfaces how */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
        <span>
          Pathao and RedX can push status updates to <code className="text-slate-300">POST /api/v1/couriers/webhooks/&lt;provider&gt;</code>.
          Set <code className="text-slate-300">COURIER_WEBHOOK_SECRET</code> in the server environment and send it as the
          <code className="text-slate-300"> x-webhook-token</code> header to lock the endpoint down.
        </span>
      </div>

      {/* Dispatch modal */}
      <Modal isOpen={!!shipOrder} onClose={() => setShipOrder(null)} title={`Dispatch ${shipOrder?.orderNo || ''}`}>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>{shipOrder?.customer?.name}</span>
              <span>{shipOrder?.customer?.phone}</span>
            </div>
            <p className="text-slate-500">{shipOrder?.customer?.address}</p>
            <div className="flex justify-between text-white font-semibold pt-1 border-t border-slate-800">
              <span>Order value (COD)</span>
              <span>{money(shipOrder?.totalAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Courier</label>
              <select
                value={shipForm.provider}
                onChange={(e) => setShipForm({ ...shipForm, provider: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {providers.map((p: any) => (
                  <option key={p.provider} value={p.provider}>
                    {p.provider}
                    {p.mode === 'LIVE' ? ' (live)' : p.mode === 'MANUAL' ? ' (manual record)' : ' (not configured — will be recorded manually)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Delivery fee (BDT)</label>
              <Input type="number" value={shipForm.deliveryFee} onChange={(e) => setShipForm({ ...shipForm, deliveryFee: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Weight (kg)</label>
              <Input type="number" value={shipForm.weightKg} onChange={(e) => setShipForm({ ...shipForm, weightKg: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Consignment id (optional)</label>
              <Input value={shipForm.consignmentId} onChange={(e) => setShipForm({ ...shipForm, consignmentId: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Tracking code (optional)</label>
              <Input value={shipForm.trackingCode} onChange={(e) => setShipForm({ ...shipForm, trackingCode: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Note</label>
              <Input value={shipForm.note} onChange={(e) => setShipForm({ ...shipForm, note: e.target.value })} placeholder="e.g. Handle with care" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShipOrder(null)}>
              Cancel
            </Button>
            <Button onClick={() => shipMutation.mutate()} disabled={shipMutation.isPending}>
              {shipMutation.isPending ? 'Dispatching…' : 'Dispatch order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status modal */}
      <Modal isOpen={!!statusTarget} onClose={() => setStatusTarget(null)} title={`Courier status — ${statusTarget?.orderNo || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">New status</label>
            <select
              value={statusForm.status}
              onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
            >
              {COURIER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Marking a parcel <strong>delivered</strong> closes the order and records the COD as collected.
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-400">Note</label>
            <Input value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}>
              {statusMutation.isPending ? 'Saving…' : 'Update status'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Provider performance */}
      {stats?.data?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Courier performance</h3>
          <ReportTable
            headers={[
              { label: 'Provider' },
              { label: 'Shipments', align: 'right' },
              { label: 'Delivered', align: 'right' },
              { label: 'Returned / Failed', align: 'right' },
              { label: 'Success %', align: 'right' },
              { label: 'Avg Days', align: 'right' },
              { label: 'COD Collected', align: 'right' },
            ]}
            isEmpty={false}
          >
            {stats.data.map((c: any) => (
              <tr key={c.provider} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 text-white font-medium">{c.provider}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{c.shipments}</td>
                <td className="py-2.5 px-4 text-right text-emerald-400">{c.delivered}</td>
                <td className="py-2.5 px-4 text-right text-rose-400">{c.returnedOrFailed}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{c.successRatePercent}%</td>
                <td className="py-2.5 px-4 text-right text-slate-400">{c.averageDeliveryDays ?? '—'}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{money(c.codCollected)}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}
    </div>
  );
}
