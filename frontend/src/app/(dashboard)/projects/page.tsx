'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  TrendingUp,
  Wallet,
  Target,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { KpiCard } from '../../../components/reports/KpiCard';
import { ReportTable, money } from '../../../components/reports/ReportShell';

const STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

const statusVariant = (s: string) =>
  s === 'ACTIVE'
    ? 'success'
    : s === 'PLANNED'
    ? 'info'
    : s === 'ON_HOLD'
    ? 'warning'
    : s === 'COMPLETED'
    ? 'purple'
    : 'danger';

const emptyForm = {
  name: '',
  description: '',
  budget: '',
  customerId: '',
  managerId: '',
  startDate: '',
  endDate: '',
  status: 'PLANNED',
};

export default function ProjectsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'projects' | 'pnl'>('projects');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<any | null>(null);

  const { data: projects = [], isLoading } = useQuery<any[]>({
    queryKey: ['projects', statusFilter],
    queryFn: async () => (await api.get('/projects', { params: { status: statusFilter || undefined } })).data || [],
  });

  const { data: pnl } = useQuery<any>({
    queryKey: ['project-pnl'],
    queryFn: async () => (await api.get('/reports/project-pnl')).data,
    enabled: tab === 'pnl',
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['customers-for-projects'],
    queryFn: async () => (await api.get('/customers?limit=200')).data?.data || [],
    enabled: modalOpen,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['users-for-projects'],
    queryFn: async () => (await api.get('/users?limit=200')).data?.data || [],
    enabled: modalOpen,
  });

  const { data: projectDetail } = useQuery<any>({
    queryKey: ['project-detail', detail?._id],
    queryFn: async () => (await api.get(`/projects/${detail!._id}`)).data,
    enabled: !!detail,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        description: form.description || undefined,
        budget: Number(form.budget) || 0,
        customerId: form.customerId || null,
        managerId: form.managerId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
      };
      return editing ? api.put(`/projects/${editing._id}`, body) : api.post('/projects', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Project updated' : 'Project created');
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-pnl'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not save the project'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-pnl'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not delete the project'),
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      budget: String(p.budget || ''),
      customerId: p.customerId?._id || '',
      managerId: p.managerId?._id || '',
      startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : '',
      status: p.status,
    });
    setModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <FolderKanban className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Projects</h1>
            <p className="text-xs text-slate-400">
              Job costing — revenue from sales, costs from purchases &amp; expenses, profit per project
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> New Project
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-3.5 h-3.5" />, count: projects.length },
          { key: 'pnl', label: 'Profit & Loss', icon: <TrendingUp className="w-3.5 h-3.5" /> },
        ]}
        activeTab={tab}
        onChange={(k) => setTab(k as 'projects' | 'pnl')}
        variant="pills"
      />

      {tab === 'projects' && (
        <div className="space-y-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <ReportTable
            headers={[
              { label: 'Project' },
              { label: 'Customer' },
              { label: 'Manager' },
              { label: 'Budget', align: 'right' },
              { label: 'Revenue', align: 'right' },
              { label: 'Cost', align: 'right' },
              { label: 'Profit', align: 'right' },
              { label: 'Margin', align: 'right' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' },
            ]}
            isEmpty={!isLoading && projects.length === 0}
            empty="No project yet — create one to start tracking job costs and revenue."
          >
            {projects.map((p: any) => (
              <tr key={p._id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4">
                  <button onClick={() => setDetail(p)} className="text-left">
                    <span className="text-white font-medium">{p.name}</span>
                    <span className="block font-mono text-[10px] text-slate-500">{p.code}</span>
                  </button>
                </td>
                <td className="py-2.5 px-4 text-slate-400">{p.customerId?.name || '—'}</td>
                <td className="py-2.5 px-4 text-slate-400">{p.managerId?.fullName || '—'}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{money(p.budget)}</td>
                <td className="py-2.5 px-4 text-right text-emerald-400">{money(p.revenue)}</td>
                <td className="py-2.5 px-4 text-right text-amber-400">{money(p.totalCost)}</td>
                <td className={`py-2.5 px-4 text-right font-semibold ${(p.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {money(p.profit)}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-400">{p.marginPercent}%</td>
                <td className="py-2.5 px-4 text-center">
                  <Badge variant={statusVariant(p.status) as any}>{p.status.replace('_', ' ')}</Badge>
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded text-slate-400 hover:text-blue-400">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${p.name}?`)) deleteMutation.mutate(p._id);
                      }}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      {tab === 'pnl' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard label="Projects" value={String(pnl?.summary?.projects ?? 0)} tone="indigo" />
            <KpiCard label="Revenue" value={money(pnl?.summary?.revenue)} tone="emerald" />
            <KpiCard label="Total Cost" value={money(pnl?.summary?.cost)} tone="amber" />
            <KpiCard label="Profit" value={money(pnl?.summary?.profit)} tone="white" hint={`Margin ${pnl?.summary?.overallMarginPercent ?? 0}%`} />
            <KpiCard
              label="Budget Used"
              value={pnl?.summary?.budgetUtilisationPercent === null ? '—' : `${pnl?.summary?.budgetUtilisationPercent ?? 0}%`}
              tone="purple"
              hint={`${pnl?.summary?.lossMakingProjects ?? 0} loss-making project(s)`}
            />
          </div>

          <ReportTable
            headers={[
              { label: 'Code' },
              { label: 'Project' },
              { label: 'Budget', align: 'right' },
              { label: 'Revenue', align: 'right' },
              { label: 'Purchases', align: 'right' },
              { label: 'Expenses', align: 'right' },
              { label: 'Total Cost', align: 'right' },
              { label: 'Profit', align: 'right' },
              { label: 'Margin', align: 'right' },
              { label: 'Budget Used', align: 'right' },
            ]}
            isEmpty={!(pnl?.data || []).length}
            empty="Nothing to report yet."
          >
            {(pnl?.data || []).map((r: any) => (
              <tr key={r.projectId} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{r.code}</td>
                <td className="py-2.5 px-4 text-white">
                  {r.name}
                  <span className="block text-[10px] text-slate-500">
                    {r.status} · {r.customerName}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-slate-400">{money(r.budget)}</td>
                <td className="py-2.5 px-4 text-right text-emerald-400">{money(r.revenue)}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{money(r.purchases)}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{money(r.expenses)}</td>
                <td className="py-2.5 px-4 text-right text-amber-400">{money(r.totalCost)}</td>
                <td className={`py-2.5 px-4 text-right font-semibold ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {money(r.profit)}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-400">{r.marginPercent}%</td>
                <td className="py-2.5 px-4 text-right">
                  {r.budgetUsedPercent === null ? (
                    '—'
                  ) : (
                    <span className={r.budgetUsedPercent > 100 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                      {r.budgetUsedPercent}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New project'}
        size="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Project name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Customer</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">—</option>
                {customers.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Project manager</label>
              <select
                value={form.managerId}
                onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">—</option>
                {users.map((u: any) => (
                  <option key={u._id} value={u._id}>
                    {u.fullName || u.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Budget (BDT)</label>
              <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Start date</label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">End date</label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
            Attach sales, purchase orders and expenses to this project (<code>projectId</code>) to have them counted in
            its P&amp;L.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{detail.name}</h3>
                <p className="text-xs text-slate-400">
                  {detail.code} · {detail.status}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="Budget" value={money(detail.budget)} tone="indigo" />
                <KpiCard label="Revenue" value={money(detail.revenue)} tone="emerald" />
                <KpiCard label="Cost" value={money(detail.totalCost)} tone="amber" />
                <KpiCard label="Profit" value={money(detail.profit)} tone={detail.profit >= 0 ? 'white' : 'rose'} />
              </div>

              {projectDetail && (
                <>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Sales ({projectDetail.sales?.length || 0})
                    </h4>
                    <ReportTable
                      headers={[
                        { label: 'Invoice' },
                        { label: 'Date', align: 'center' },
                        { label: 'Tier', align: 'center' },
                        { label: 'Total', align: 'right' },
                        { label: 'Due', align: 'right' },
                      ]}
                      isEmpty={!(projectDetail.sales || []).length}
                      empty="No sales linked yet."
                    >
                      {(projectDetail.sales || []).map((s: any) => (
                        <tr key={s._id}>
                          <td className="py-2 px-4 font-mono text-[11px] text-white">{s.invoiceNo}</td>
                          <td className="py-2 px-4 text-center text-slate-400">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-4 text-center text-slate-400">{s.pricingTier}</td>
                          <td className="py-2 px-4 text-right text-emerald-400">{money(s.totalAmount)}</td>
                          <td className="py-2 px-4 text-right text-rose-400">{money(s.dueAmount)}</td>
                        </tr>
                      ))}
                    </ReportTable>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" /> Purchase orders ({projectDetail.purchaseOrders?.length || 0})
                    </h4>
                    <ReportTable
                      headers={[
                        { label: 'PO' },
                        { label: 'Supplier' },
                        { label: 'Status', align: 'center' },
                        { label: 'Total', align: 'right' },
                      ]}
                      isEmpty={!(projectDetail.purchaseOrders || []).length}
                      empty="No purchase orders linked yet."
                    >
                      {(projectDetail.purchaseOrders || []).map((po: any) => (
                        <tr key={po._id}>
                          <td className="py-2 px-4 font-mono text-[11px] text-white">{po.poNumber}</td>
                          <td className="py-2 px-4 text-slate-400">{po.supplierId?.companyName || '—'}</td>
                          <td className="py-2 px-4 text-center">
                            <Badge variant="neutral">{po.status}</Badge>
                          </td>
                          <td className="py-2 px-4 text-right text-amber-400">{money(po.totalAmount)}</td>
                        </tr>
                      ))}
                    </ReportTable>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-rose-400" /> Expenses ({projectDetail.expenses?.length || 0})
                    </h4>
                    <ReportTable
                      headers={[
                        { label: 'Description' },
                        { label: 'Category' },
                        { label: 'Status', align: 'center' },
                        { label: 'Amount', align: 'right' },
                      ]}
                      isEmpty={!(projectDetail.expenses || []).length}
                      empty="No expenses linked yet."
                    >
                      {(projectDetail.expenses || []).map((e: any) => (
                        <tr key={e._id}>
                          <td className="py-2 px-4 text-slate-300">{e.description}</td>
                          <td className="py-2 px-4 text-slate-400">{e.categoryId?.name || '—'}</td>
                          <td className="py-2 px-4 text-center">
                            <Badge variant={e.status === 'APPROVED' ? 'success' : 'warning'}>{e.status}</Badge>
                          </td>
                          <td className="py-2 px-4 text-right text-rose-400">{money(e.amount)}</td>
                        </tr>
                      ))}
                    </ReportTable>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
