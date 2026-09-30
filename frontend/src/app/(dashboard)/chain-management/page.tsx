'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Store,
  TrendingUp,
  Wallet,
  Package,
  Truck,
  Users,
  Crown,
  BarChart3,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';

const BRANCH_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const money = (v: number) => `৳${(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Branch {
  _id: string;
  name: string;
  code: string;
  city?: string;
  address?: string;
  phone?: string;
  isHeadOffice: boolean;
  isActive: boolean;
  managerId?: any;
  todaySales?: number;
  todayInvoiceCount?: number;
  staffCount?: number;
  settings?: { allowNegativeStock?: boolean; defaultPriceType?: string };
}

interface ChainBranch {
  id: string;
  name: string;
  code: string;
  city?: string;
  isHeadOffice: boolean;
  revenue: number;
  invoices: number;
  stockValue: number;
  stockItems: number;
  purchases: number;
  pendingPurchaseOrders: number;
}

interface ChainDashboard {
  branches: ChainBranch[];
  totals: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    due: number;
    invoices: number;
  } | null;
  monthlySeries: Array<Record<string, any>>;
  pnl: Array<{
    branchId: string;
    branchName: string;
    code: string;
    revenue: number;
    invoices: number;
    due: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    expenses: number;
    netProfit: number;
  }>;
}

interface BranchStats {
  todayRevenue: number;
  todayInvoices: number;
  todayDue: number;
  todayDiscount: number;
  stockValue: number;
  variantCount: number;
  pendingPurchaseOrders: number;
  lowStockItems: number;
  transfersOut: number;
  transfersIn: number;
}

const emptyForm = {
  name: '',
  code: '',
  city: '',
  address: '',
  phone: '',
  isHeadOffice: false,
  isActive: true,
  allowNegativeStock: false,
  defaultPriceType: 'RETAIL' as 'RETAIL' | 'WHOLESALE',
};

export default function ChainManagementPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = (user?.permissions || []).includes('settings:manage');

  const [months, setMonths] = useState(6);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Branch | null>(null);

  const { data: branches = [], isLoading: loadingBranches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches?includeInactive=true')).data || [],
  });

  const { data: chain, isLoading: loadingChain, refetch } = useQuery<ChainDashboard>({
    queryKey: ['chain-dashboard', months],
    queryFn: async () => (await api.get(`/branches/chain-dashboard?months=${months}`)).data!,
  });

  const { data: stats } = useQuery<BranchStats>({
    queryKey: ['branch-stats', detail?._id],
    queryFn: async () => (await api.get(`/branches/${detail!._id}/stats`)).data!,
    enabled: !!detail,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm) => {
      const body = {
        name: payload.name,
        code: payload.code,
        city: payload.city || undefined,
        address: payload.address || undefined,
        phone: payload.phone || undefined,
        isHeadOffice: payload.isHeadOffice,
        isActive: payload.isActive,
        settings: {
          allowNegativeStock: payload.allowNegativeStock,
          defaultPriceType: payload.defaultPriceType,
        },
      };
      return editing ? api.put(`/branches/${editing._id}`, body) : api.post('/branches', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Branch updated' : 'Branch created');
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['chain-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Could not save branch'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      toast.success('Branch deleted');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['chain-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Could not delete branch'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code,
      city: b.city || '',
      address: b.address || '',
      phone: b.phone || '',
      isHeadOffice: b.isHeadOffice,
      isActive: b.isActive,
      allowNegativeStock: !!b.settings?.allowNegativeStock,
      defaultPriceType: (b.settings?.defaultPriceType as any) || 'RETAIL',
    });
    setModalOpen(true);
  };

  // One colour per branch, reused by every bar in the chart
  const branchCodes = useMemo(() => (chain?.branches || []).map((b) => b.code), [chain]);
  const colorFor = (code: string) => BRANCH_COLORS[branchCodes.indexOf(code) % BRANCH_COLORS.length];

  const totals = chain?.totals;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Chain Management</h1>
            <p className="text-xs text-slate-400">
              Every shop in one view — sales, stock and profit per branch
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Branch
            </Button>
          )}
        </div>
      </div>

      {/* Consolidated KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Chain Revenue', value: money(totals?.revenue || 0), icon: TrendingUp, tint: 'emerald' },
          { label: 'Gross Profit', value: money(totals?.grossProfit || 0), icon: BarChart3, tint: 'blue' },
          { label: 'Net Profit', value: money(totals?.netProfit || 0), icon: Wallet, tint: 'violet' },
          { label: 'Customer Dues', value: money(totals?.due || 0), icon: Users, tint: 'amber' },
          { label: 'Invoices', value: String(totals?.invoices || 0), icon: Store, tint: 'slate' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 border-l-4"
            style={{ borderLeftColor: `var(--tint-${kpi.tint})` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">{kpi.label}</span>
              <kpi.icon className="w-4 h-4 text-slate-500" />
            </div>
            <p className="mt-1.5 text-lg font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Branch cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Branches ({branches.length})</h2>
        {loadingBranches ? (
          <p className="text-xs text-slate-500">Loading branches…</p>
        ) : branches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-300">No branches yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Add your head office first, then each showroom — every sale is tagged with its branch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {branches.map((b) => {
              const row = chain?.branches.find((c) => c.id === b._id);
              return (
                <div
                  key={b._id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 shrink-0">
                        {b.isHeadOffice ? (
                          <Crown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Store className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{b.name}</p>
                          {!b.isActive && <Badge variant="danger">Inactive</Badge>}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {b.code}
                          {b.city ? ` · ${b.city}` : ''}
                          {b.isHeadOffice ? ' · Head Office' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(b)}
                            className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete branch ${b.name}?`)) deleteMutation.mutate(b._id);
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2">
                      <p className="text-[10px] uppercase text-slate-500">Today</p>
                      <p className="text-sm font-semibold text-emerald-400">{money(b.todaySales || 0)}</p>
                      <p className="text-[10px] text-slate-500">{b.todayInvoiceCount || 0} invoice(s)</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2">
                      <p className="text-[10px] uppercase text-slate-500">Stock Value</p>
                      <p className="text-sm font-semibold text-blue-400">{money(row?.stockValue || 0)}</p>
                      <p className="text-[10px] text-slate-500">{row?.stockItems || 0} item(s)</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {b.staffCount || 0} staff
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" /> {row?.pendingPurchaseOrders || 0} open PO
                    </span>
                    <button onClick={() => setDetail(b)} className="text-blue-400 hover:text-blue-300 font-medium">
                      Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Revenue by branch (monthly)</h2>
        </div>
        {loadingChain ? (
          <p className="text-xs text-slate-500">Loading chart…</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chain?.monthlySeries || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => money(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {branchCodes.map((code) => (
                  <Bar key={code} dataKey={code} fill={colorFor(code)} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* P&L table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Profit &amp; loss by branch</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/60 text-slate-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Branch</th>
                <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
                <th className="text-right px-4 py-2.5 font-medium">Purchases (COGS)</th>
                <th className="text-right px-4 py-2.5 font-medium">Gross Profit</th>
                <th className="text-right px-4 py-2.5 font-medium">Margin</th>
                <th className="text-right px-4 py-2.5 font-medium">Expenses</th>
                <th className="text-right px-4 py-2.5 font-medium">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(chain?.pnl || []).map((row) => (
                <tr key={row.branchId} className="text-slate-300 hover:bg-slate-800/30">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-white">{row.branchName}</span>
                    <span className="text-slate-500 ml-1.5">{row.code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{money(row.revenue)}</td>
                  <td className="px-4 py-2.5 text-right">{money(row.cogs)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{money(row.grossProfit)}</td>
                  <td className="px-4 py-2.5 text-right">{row.grossMargin}%</td>
                  <td className="px-4 py-2.5 text-right text-amber-400">{money(row.expenses)}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${
                      row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {money(row.netProfit)}
                  </td>
                </tr>
              ))}
              {(!chain?.pnl || chain.pnl.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No branch activity yet
                  </td>
                </tr>
              )}
            </tbody>
            {totals && (
              <tfoot className="bg-slate-950/60 text-white font-semibold">
                <tr>
                  <td className="px-4 py-2.5">Chain total</td>
                  <td className="px-4 py-2.5 text-right">{money(totals.revenue)}</td>
                  <td className="px-4 py-2.5 text-right">{money(totals.cogs)}</td>
                  <td className="px-4 py-2.5 text-right">{money(totals.grossProfit)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {totals.revenue > 0 ? ((totals.grossProfit / totals.revenue) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-4 py-2.5 text-right">{money(totals.expenses)}</td>
                  <td className="px-4 py-2.5 text-right">{money(totals.netProfit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Create / edit branch */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : 'Add branch'}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Branch name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Unique Home Textile — Main Road"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Code *</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="BR-001"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">City</label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Dhaka" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Default price type</label>
              <select
                value={form.defaultPriceType}
                onChange={(e) => setForm({ ...form, defaultPriceType: e.target.value as any })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Address</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {[
              { key: 'isHeadOffice' as const, label: 'This is the head office' },
              { key: 'isActive' as const, label: 'Active' },
              { key: 'allowNegativeStock' as const, label: 'Allow negative stock' },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form[opt.key] as boolean}
                  onChange={(e) => setForm({ ...form, [opt.key]: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-800"
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name.trim() || !form.code.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create branch'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Branch detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  {detail.isHeadOffice && <Crown className="w-4 h-4 text-amber-400" />}
                  {detail.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {detail.code}
                  {detail.city ? ` · ${detail.city}` : ''}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: "Today's sales", value: money(stats?.todayRevenue || 0), hint: `${stats?.todayInvoices || 0} invoices` },
                { label: 'Stock value', value: money(stats?.stockValue || 0), hint: `${stats?.variantCount || 0} items` },
                { label: 'Low stock', value: String(stats?.lowStockItems || 0), hint: 'items at/below alert' },
                { label: 'Open POs', value: String(stats?.pendingPurchaseOrders || 0), hint: 'not yet received' },
                { label: 'Transfers out', value: String(stats?.transfersOut || 0), hint: 'pending / in transit' },
                { label: 'Transfers in', value: String(stats?.transfersIn || 0), hint: 'pending / in transit' },
                { label: "Today's dues", value: money(stats?.todayDue || 0), hint: 'credit given today' },
                { label: "Today's discount", value: money(stats?.todayDiscount || 0), hint: 'given today' },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-[10px] uppercase text-slate-500">{row.label}</p>
                  <p className="text-sm font-semibold text-white mt-1">{row.value}</p>
                  <p className="text-[10px] text-slate-500">{row.hint}</p>
                </div>
              ))}
            </div>

            <div className="px-4 pb-6 space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5" />
                {detail.managerId?.fullName ? `Manager: ${detail.managerId.fullName}` : 'No manager assigned'}
              </p>
              {detail.phone && <p>Phone: {detail.phone}</p>}
              {detail.address && <p>Address: {detail.address}</p>}
              <p>
                Price type: {detail.settings?.defaultPriceType || 'RETAIL'} · Negative stock:{' '}
                {detail.settings?.allowNegativeStock ? 'allowed' : 'blocked'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
