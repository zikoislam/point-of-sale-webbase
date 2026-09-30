'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  ArrowRight,
  Send,
  PackageCheck,
  XCircle,
  X,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';
import { ReportTable } from '../../../components/reports/ReportShell';

const money = (v: number) => `৳${(v || 0).toFixed(2)}`;

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const;

const statusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'IN_TRANSIT':
      return 'info';
    case 'RECEIVED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'default';
  }
};

interface Branch {
  _id: string;
  name: string;
  code: string;
  isHeadOffice: boolean;
}

interface TransferItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitCost: number;
  receivedQty: number;
}

interface Transfer {
  _id: string;
  transferNumber: string;
  fromBranchId: any;
  toBranchId: any;
  items: TransferItem[];
  totalValue: number;
  status: string;
  approvalStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approvedById?: any;
  approvedAt?: string;
  requestedById?: any;
  createdAt: string;
  sentAt?: string;
  receivedAt?: string;
  notes?: string;
  createdBy?: any;
  sentBy?: any;
  receivedBy?: any;
}

interface DraftLine {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  available: number;
  costPrice: number;
  quantity: number;
}

type TransferView = 'all' | 'approvals' | 'incoming' | 'in_transit';

export default function StockTransfersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = (user?.permissions || []).includes('inv:manage');

  const [view, setView] = useState<TransferView>('all');
  const [status, setStatus] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [detail, setDetail] = useState<Transfer | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivedQty, setReceivedQty] = useState<Record<string, number>>({});

  // create form
  const [createOpen, setCreateOpen] = useState(false);
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(productSearch), 350);
    return () => clearTimeout(t);
  }, [productSearch]);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data || [],
  });

  const { data: transfers, isLoading, refetch } = useQuery<{ data: Transfer[] }>({
    queryKey: ['stock-transfers', status, branchFilter],
    queryFn: async () =>
      (await api.get('/stock-transfers', { params: { status: status || undefined, branchId: branchFilter || undefined, limit: 50 } }))
        .data as any,
  });

  /** Manager queue: issue requests that have not moved yet. */
  const { data: approvals } = useQuery<any>({
    queryKey: ['stock-transfer-approvals'],
    queryFn: async () => (await api.get('/stock-transfers/pending-approval')).data,
    enabled: view === 'approvals',
  });

  /** Destination branch board: approved, dispatched, waiting to be received. */
  const { data: incoming } = useQuery<any>({
    queryKey: ['stock-transfer-incoming'],
    queryFn: async () => (await api.get('/stock-transfers/incoming')).data,
    enabled: view === 'incoming',
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['transfer-product-search', debounced],
    queryFn: async () =>
      (await api.get(`/products?search=${encodeURIComponent(debounced)}&limit=10`)).data?.data || [],
    enabled: debounced.length >= 2 && !!fromBranch,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post('/stock-transfers', {
        fromBranchId: fromBranch,
        toBranchId: toBranch,
        notes: notes || undefined,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      }),
    onSuccess: (res: any) => {
      // Staff-raised issues go to a manager first; manager issues dispatch now
      toast.success(res?.message || 'Stock transfer created');
      setCreateOpen(false);
      setLines([]);
      setNotes('');
      setProductSearch('');
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-incoming'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Could not create transfer'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: string; body?: any }) =>
      api.put(`/stock-transfers/${id}/${action}`, body),
    onSuccess: (res: any, vars) => {
      toast.success(res?.message || (
        vars.action === 'approve'
          ? 'Issue request approved and dispatched'
          : vars.action === 'reject'
          ? 'Issue request rejected'
          : vars.action === 'send'
          ? 'Transfer dispatched'
          : vars.action === 'receive'
          ? 'Stock received — branch stock updated'
          : 'Transfer cancelled'
      ));
      setReceiveOpen(false);
      setDetail(null);
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-incoming'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Action failed'),
  });

  /** Load a product's per-branch stock so the quantity can be validated up front. */
  const addProductLine = async (product: any) => {
    try {
      const res = await api.get(`/branches/product-availability/${product.id || product._id}`);
      const rows = res.data?.rows || [];
      const added: DraftLine[] = [];
      for (const row of rows) {
        if (lines.some((l) => l.variantId === row.variantId)) continue;
        added.push({
          productId: product.id || product._id,
          variantId: row.variantId,
          productName: row.sku ? `${product.name} — ${row.variantName}` : product.name,
          variantName: row.variantName || '',
          sku: row.sku || '',
          available: row.quantity,
          costPrice: row.costPrice || 0,
          quantity: 1,
        });
      }
      if (added.length === 0) toast.info('All variants of this product are already added');
      setLines((prev) => [...prev, ...added]);
      setProductSearch('');
    } catch {
      toast.error('Could not load product stock');
    }
  };

  const branchName = (b: any) => (typeof b === 'string' ? b : b?.name || '—');
  const rows = transfers?.data || [];

  const totals = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === 'PENDING').length,
      inTransit: rows.filter((r) => r.status === 'IN_TRANSIT').length,
      value: rows.reduce((s, r) => s + (r.totalValue || 0), 0),
    }),
    [rows]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <Truck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Stock Transfers</h1>
            <p className="text-xs text-slate-400">Move stock between branches with a proper challan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setCreateOpen(true);
                setFromBranch(branches[0]?._id || '');
                setToBranch(branches[1]?._id || '');
              }}
              disabled={branches.length < 2}
              title={branches.length < 2 ? 'Add at least two branches first' : undefined}
            >
              <Plus className="w-4 h-4 mr-1.5" /> New Transfer
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: String(totals.pending), tint: 'text-amber-400' },
          { label: 'In transit', value: String(totals.inTransit), tint: 'text-blue-400' },
          { label: 'Value (listed)', value: money(totals.value), tint: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className={`mt-1 text-lg font-bold ${s.tint}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* View switcher: the whole log, the manager queue, or what is on its way here */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        {([
          { key: 'all', label: 'All Transfers' },
          { key: 'approvals', label: `Waiting Approval${approvals?.summary?.requests ? ` (${approvals.summary.requests})` : ''}` },
          { key: 'incoming', label: `Incoming Stock${incoming?.summary?.transfers ? ` (${incoming.summary.transfers})` : ''}` },
          { key: 'in_transit', label: 'In Transit' },
        ] as { key: TransferView; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setView(tab.key);
              if (tab.key === 'in_transit') setStatus('IN_TRANSIT');
              else if (tab.key !== 'all') setStatus('');
            }}
            className={`px-3.5 py-2 text-xs rounded-lg font-medium transition-colors ${
              view === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Manager approval queue */}
      {view === 'approvals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-amber-300/80">Requests waiting</p>
              <p className="mt-1 text-lg font-bold text-amber-300">{approvals?.summary?.requests ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Value waiting</p>
              <p className="mt-1 text-lg font-bold text-white">{money(approvals?.summary?.value)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Oldest request</p>
              <p className="mt-1 text-sm font-bold text-slate-200">
                {approvals?.summary?.oldestRequestedAt
                  ? new Date(approvals.summary.oldestRequestedAt).toLocaleDateString()
                  : '—'}
              </p>
            </div>
          </div>

          <ReportTable
            headers={[
              { label: 'Transfer #' },
              { label: 'Route' },
              { label: 'Items', align: 'right' },
              { label: 'Value', align: 'right' },
              { label: 'Requested by' },
              { label: 'Requested', align: 'center' },
              { label: 'Decision', align: 'right' },
            ]}
            isEmpty={!(approvals?.data || []).length}
            empty="No issue request waiting for approval."
          >
            {(approvals?.data || []).map((t: Transfer) => (
              <tr key={t._id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-mono text-[11px] text-white">{t.transferNumber}</td>
                <td className="py-2.5 px-4 text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    {branchName(t.fromBranchId)}
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-white font-medium">{branchName(t.toBranchId)}</span>
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-slate-300">{t.items.length}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{money(t.totalValue)}</td>
                <td className="py-2.5 px-4 text-slate-400">
                  {t.requestedById?.fullName || t.createdBy?.fullName || '—'}
                </td>
                <td className="py-2.5 px-4 text-center text-slate-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => actionMutation.mutate({ id: t._id, action: 'approve', body: { note: 'Approved from the approval queue' } })}
                      className="px-2.5 py-1 rounded text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Approve &amp; issue
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Why is this issue request rejected?') || undefined;
                        actionMutation.mutate({ id: t._id, action: 'reject', body: { reason } });
                      }}
                      className="px-2.5 py-1 rounded text-[11px] text-rose-400 hover:bg-slate-800 inline-flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      {/* Incoming stock for the destination branch */}
      {view === 'incoming' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-blue-300/80">Incoming transfers</p>
              <p className="mt-1 text-lg font-bold text-blue-300">{incoming?.summary?.transfers ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Items on the way</p>
              <p className="mt-1 text-lg font-bold text-white">{incoming?.summary?.items ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Value on the way</p>
              <p className="mt-1 text-lg font-bold text-white">{money(incoming?.summary?.value)}</p>
            </div>
          </div>

          {(user as any)?.branchName && (
            <p className="text-[11px] text-slate-400">
              Showing stock issued to <span className="text-white font-medium">{(user as any).branchName}</span>. Use the branch
              filter above to look at another branch.
            </p>
          )}

          <ReportTable
            headers={[
              { label: 'Transfer #' },
              { label: 'From' },
              { label: 'Items' },
              { label: 'Value', align: 'right' },
              { label: 'Approved by' },
              { label: 'Dispatched', align: 'center' },
              { label: 'Action', align: 'right' },
            ]}
            isEmpty={!(incoming?.data || []).length}
            empty="Nothing is on its way to this branch."
          >
            {(incoming?.data || []).map((t: Transfer) => (
              <tr key={t._id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-mono text-[11px] text-white">{t.transferNumber}</td>
                <td className="py-2.5 px-4 text-slate-300">{branchName(t.fromBranchId)}</td>
                <td className="py-2.5 px-4 text-slate-400">
                  {t.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-300">{money(t.totalValue)}</td>
                <td className="py-2.5 px-4 text-slate-400">{t.approvedById?.fullName || '—'}</td>
                <td className="py-2.5 px-4 text-center text-slate-400">
                  {t.sentAt ? new Date(t.sentAt).toLocaleDateString() : '—'}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => {
                        setDetail(t);
                        setReceivedQty(Object.fromEntries(t.items.map((i) => [i.variantId, i.quantity])));
                        setReceiveOpen(true);
                      }}
                      className="px-2.5 py-1 rounded text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1"
                    >
                      <PackageCheck className="w-3 h-3" /> Receive stock
                    </button>
                    <button
                      onClick={() => setDetail(t)}
                      className="px-2 py-1 rounded text-[11px] text-blue-400 hover:bg-slate-800"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      {/* Filters */}
      {view === 'all' && (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                status === tab.key ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      )}

      {/* Table (the full log, and the in-transit slice of it) */}
      {view !== 'approvals' && view !== 'incoming' && (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Transfer #</th>
                <th className="text-left px-4 py-2.5 font-medium">Route</th>
                <th className="text-center px-4 py-2.5 font-medium">Items</th>
                <th className="text-right px-4 py-2.5 font-medium">Value</th>
                <th className="text-center px-4 py-2.5 font-medium">Approval</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading transfers…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No transfers yet
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t._id} className="text-slate-300 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-white">{t.transferNumber}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        {branchName(t.fromBranchId)}
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        {branchName(t.toBranchId)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">{t.items.length}</td>
                    <td className="px-4 py-2.5 text-right">{money(t.totalValue)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {t.approvalStatus === 'PENDING_APPROVAL' ? (
                        <Badge variant="warning">Waiting approval</Badge>
                      ) : t.approvalStatus === 'REJECTED' ? (
                        <Badge variant="danger">Rejected</Badge>
                      ) : (
                        <Badge variant="success">Approved</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={statusBadge(t.status) as any}>{t.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                      <span className="text-slate-500 ml-1">{t.createdBy?.fullName || ''}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetail(t)}
                          className="px-2 py-1 rounded text-[11px] text-blue-400 hover:bg-slate-800"
                        >
                          View
                        </button>
                        {canManage && t.status === 'PENDING' && t.approvalStatus === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => actionMutation.mutate({ id: t._id, action: 'approve', body: { note: 'Approved' } })}
                              className="px-2 py-1 rounded text-[11px] text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Why is this issue request rejected?') || undefined;
                                actionMutation.mutate({ id: t._id, action: 'reject', body: { reason } });
                              }}
                              className="px-2 py-1 rounded text-[11px] text-rose-400 hover:bg-slate-800"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canManage && t.status === 'PENDING' && t.approvalStatus === 'APPROVED' && (
                          <button
                            onClick={() => actionMutation.mutate({ id: t._id, action: 'send' })}
                            className="px-2 py-1 rounded text-[11px] text-amber-400 hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Issue
                          </button>
                        )}
                        {canManage && t.status === 'IN_TRANSIT' && (
                          <button
                            onClick={() => {
                              setDetail(t);
                              setReceivedQty(Object.fromEntries(t.items.map((i) => [i.variantId, i.quantity])));
                              setReceiveOpen(true);
                            }}
                            className="px-2 py-1 rounded text-[11px] text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <PackageCheck className="w-3 h-3" /> Receive
                          </button>
                        )}
                        {canManage && (t.status === 'PENDING' || t.status === 'IN_TRANSIT') && (
                          <button
                            onClick={() => {
                              const reason = prompt('Cancellation reason (optional)') || undefined;
                              actionMutation.mutate({ id: t._id, action: 'cancel', body: { reason } });
                            }}
                            className="px-2 py-1 rounded text-[11px] text-rose-400 hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New stock transfer" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">From branch *</label>
              <select
                value={fromBranch}
                onChange={(e) => {
                  setFromBranch(e.target.value);
                  setLines([]);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">To branch *</label>
              <select
                value={toBranch}
                onChange={(e) => setToBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">Select branch</option>
                {branches
                  .filter((b) => b._id !== fromBranch)
                  .map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Product search */}
          <div className="relative">
            <label className="text-xs text-slate-400">Add products</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={fromBranch ? 'Search product by name, SKU or barcode…' : 'Choose the source branch first'}
                disabled={!fromBranch}
                className="pl-9"
              />
            </div>
            {debounced.length >= 2 && products.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                {products.map((p) => (
                  <button
                    key={p.id || p._id}
                    onClick={() => addProductLine(p)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-slate-500">{p.sku || p.primarySku || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-right px-3 py-2 font-medium">Available</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Qty</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      No items added yet
                    </td>
                  </tr>
                ) : (
                  lines.map((l, idx) => (
                    <tr key={l.variantId}>
                      <td className="px-3 py-2 text-slate-300">
                        {l.productName}
                        <span className="block text-[10px] text-slate-500">{l.sku}</span>
                      </td>
                      <td className={`px-3 py-2 text-right ${l.available < l.quantity ? 'text-rose-400' : 'text-slate-400'}`}>
                        {l.available}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => {
                            const q = Number(e.target.value);
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: q } : x)));
                          }}
                          className="text-right"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div>
            <label className="text-xs text-slate-400">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional remark" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !fromBranch ||
                !toBranch ||
                fromBranch === toBranch ||
                lines.length === 0 ||
                lines.some((l) => l.quantity <= 0 || l.quantity > l.available) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? 'Creating…' : 'Create transfer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail drawer */}
      {detail && !receiveOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white font-mono">{detail.transferNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {branchName(detail.fromBranchId)} <ArrowRight className="w-3 h-3 inline" />{' '}
                  {branchName(detail.toBranchId)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusBadge(detail.status) as any}>{detail.status.replace('_', ' ')}</Badge>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Created</p>
                  <p className="text-slate-200 mt-1">{new Date(detail.createdAt).toLocaleString()}</p>
                  <p className="text-slate-500">{detail.createdBy?.fullName}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Value</p>
                  <p className="text-slate-200 mt-1">{money(detail.totalValue)}</p>
                  <p className="text-slate-500">{detail.items.length} item(s)</p>
                </div>
                {detail.sentAt && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Dispatched</p>
                    <p className="text-slate-200 mt-1">{new Date(detail.sentAt).toLocaleString()}</p>
                    <p className="text-slate-500">{detail.sentBy?.fullName}</p>
                  </div>
                )}
                {detail.receivedAt && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Received</p>
                    <p className="text-slate-200 mt-1">{new Date(detail.receivedAt).toLocaleString()}</p>
                    <p className="text-slate-500">{detail.receivedBy?.fullName}</p>
                  </div>
                )}
              </div>

              <table className="w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-2 font-medium">Item</th>
                    <th className="text-right py-2 font-medium">Sent</th>
                    <th className="text-right py-2 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {detail.items.map((i) => (
                    <tr key={i.variantId} className="text-slate-300">
                      <td className="py-2">
                        {i.productName}
                        <span className="block text-[10px] text-slate-500">
                          {i.variantName} {i.sku ? `· ${i.sku}` : ''}
                        </span>
                      </td>
                      <td className="py-2 text-right">{i.quantity}</td>
                      <td className="py-2 text-right">{i.receivedQty || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {detail.notes && <p className="text-xs text-slate-400">Note: {detail.notes}</p>}

              {canManage && detail.status === 'PENDING' && (
                <Button
                  className="w-full"
                  onClick={() => actionMutation.mutate({ id: detail._id, action: 'send' })}
                  disabled={actionMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-1.5" /> Dispatch this transfer
                </Button>
              )}
              {canManage && detail.status === 'IN_TRANSIT' && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setReceivedQty(Object.fromEntries(detail.items.map((i) => [i.variantId, i.quantity])));
                    setReceiveOpen(true);
                  }}
                >
                  <PackageCheck className="w-4 h-4 mr-1.5" /> Receive at {branchName(detail.toBranchId)}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receive modal */}
      <Modal isOpen={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive stock" size="lg">
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Confirm the quantity actually received. Anything short is not added to the destination branch.
          </p>
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left py-2 font-medium">Item</th>
                <th className="text-right py-2 font-medium">Sent</th>
                <th className="text-right py-2 font-medium w-28">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(detail?.items || []).map((i) => (
                <tr key={i.variantId} className="text-slate-300">
                  <td className="py-2">
                    {i.productName}
                    <span className="block text-[10px] text-slate-500">{i.variantName}</span>
                  </td>
                  <td className="py-2 text-right">{i.quantity}</td>
                  <td className="py-2">
                    <Input
                      type="number"
                      min={0}
                      max={i.quantity}
                      value={receivedQty[i.variantId] ?? i.quantity}
                      onChange={(e) =>
                        setReceivedQty((prev) => ({ ...prev, [i.variantId]: Number(e.target.value) }))
                      }
                      className="text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                detail &&
                actionMutation.mutate({
                  id: detail._id,
                  action: 'receive',
                  body: {
                    items: detail.items.map((i) => ({
                      variantId: i.variantId,
                      quantity: receivedQty[i.variantId] ?? i.quantity,
                    })),
                  },
                })
              }
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? 'Receiving…' : 'Confirm receipt'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
