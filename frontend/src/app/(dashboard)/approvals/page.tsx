'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  Plus,
  RefreshCw,
  Trash2,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
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

type Tab = 'inbox' | 'all' | 'workflows';

const ENTITY_LABELS: Record<string, string> = {
  PURCHASE_ORDER: 'Purchase Order',
  EXPENSE: 'Expense',
  LETTER_OF_CREDIT: 'Letter of Credit',
};

const statusVariant = (s: string) =>
  s === 'PENDING' ? 'warning' : s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'neutral';

interface LevelDto {
  name: string;
  approverRole: string;
  requiredApprovals: string;
  skipBelowAmount: string;
}

export default function ApprovalsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('inbox');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [entityFilter, setEntityFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ id: string; action: 'approve' | 'reject' | 'cancel'; ref: string } | null>(null);
  const [comment, setComment] = useState('');

  const [wfModal, setWfModal] = useState(false);
  const [wfForm, setWfForm] = useState({
    name: '',
    entityType: 'PURCHASE_ORDER',
    minAmount: '0',
    maxAmount: '',
    description: '',
    levels: [{ name: 'Manager review', approverRole: 'BRANCH_MANAGER', requiredApprovals: '1', skipBelowAmount: '' }] as LevelDto[],
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery<any>({
    queryKey: ['approval-inbox'],
    queryFn: async () => (await api.get('/approvals/inbox')).data,
  });

  const { data: requests, isLoading: requestsLoading } = useQuery<any>({
    queryKey: ['approval-requests', statusFilter, entityFilter],
    queryFn: async () =>
      (
        await api.get('/approvals', {
          params: { status: statusFilter || undefined, entityType: entityFilter || undefined, limit: 100 },
        })
      ).data as any,
    enabled: tab === 'all',
  });

  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ['approval-workflows'],
    queryFn: async () => (await api.get('/approvals/workflows?includeInactive=true')).data || [],
    enabled: tab === 'workflows',
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, action, comment }: { id: string; action: string; comment?: string }) =>
      api.put(`/approvals/${id}/${action}`, { comment }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.action === 'approve' ? 'Approved' : vars.action === 'reject' ? 'Rejected' : 'Cancelled'
      );
      setDecision(null);
      setComment('');
      qc.invalidateQueries({ queryKey: ['approval-inbox'] });
      qc.invalidateQueries({ queryKey: ['approval-requests'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not record the decision'),
  });

  const createWfMutation = useMutation({
    mutationFn: async () =>
      api.post('/approvals/workflows', {
        name: wfForm.name,
        entityType: wfForm.entityType,
        minAmount: Number(wfForm.minAmount) || 0,
        maxAmount: wfForm.maxAmount ? Number(wfForm.maxAmount) : null,
        description: wfForm.description || undefined,
        levels: wfForm.levels.map((l, i) => ({
          level: i + 1,
          name: l.name,
          approverRole: l.approverRole || undefined,
          requiredApprovals: Number(l.requiredApprovals) || 1,
          skipBelowAmount: l.skipBelowAmount ? Number(l.skipBelowAmount) : null,
        })),
      }),
    onSuccess: () => {
      toast.success('Workflow created');
      setWfModal(false);
      qc.invalidateQueries({ queryKey: ['approval-workflows'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the workflow'),
  });

  const deleteWfMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/approvals/workflows/${id}`),
    onSuccess: () => {
      toast.success('Workflow deleted');
      qc.invalidateQueries({ queryKey: ['approval-workflows'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not delete the workflow'),
  });

  const rows: any[] = requests?.data || [];
  const inboxRows: any[] = inbox?.data || [];

  const renderRequestRow = (r: any, i: number) => {
    const level = (r.levels || []).find((l: any) => l.level === r.currentLevel);
    const waitingDays = Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 86400000);
    const isOpen = expanded === r._id;
    return (
      <React.Fragment key={r._id || i}>
        <tr className="hover:bg-slate-800/40">
          <td className="py-2.5 px-4">
            <button onClick={() => setExpanded(isOpen ? null : r._id)} className="flex items-center gap-1.5 text-left">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>
                <span className="font-mono text-[11px] text-white">{r.entityRef}</span>
                <span className="block text-[10px] text-slate-500">{ENTITY_LABELS[r.entityType] || r.entityType}</span>
              </span>
            </button>
          </td>
          <td className="py-2.5 px-4 text-slate-300 max-w-[260px] truncate">{r.title}</td>
          <td className="py-2.5 px-4 text-right text-white font-semibold">{money(r.amount)}</td>
          <td className="py-2.5 px-4 text-center">
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
              {r.currentLevel}/{r.levels?.length || 1}
              <span className="text-slate-500">{level?.name || ''}</span>
            </span>
          </td>
          <td className="py-2.5 px-4 text-slate-400 text-[11px]">
            {r.requestedBy?.fullName || r.requestedBy?.username || '—'}
          </td>
          <td className="py-2.5 px-4 text-center">
            <span className={waitingDays > 5 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>{waitingDays}d</span>
          </td>
          <td className="py-2.5 px-4 text-center">
            <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>
          </td>
          <td className="py-2.5 px-4">
            {r.status === 'PENDING' && (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setDecision({ id: r._id, action: 'approve', ref: r.entityRef })}
                  className="px-2 py-1 rounded text-[11px] text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" /> Approve
                </button>
                <button
                  onClick={() => setDecision({ id: r._id, action: 'reject', ref: r.entityRef })}
                  className="px-2 py-1 rounded text-[11px] text-rose-400 hover:bg-slate-800 inline-flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" /> Reject
                </button>
              </div>
            )}
          </td>
        </tr>
        {isOpen && (
          <tr className="bg-slate-950/40">
            <td colSpan={8} className="px-6 py-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                {(r.levels || []).map((l: any) => (
                  <div key={l.level} className="rounded-lg border border-slate-800 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-medium">
                        Level {l.level} · {l.name}
                      </span>
                      {l.completed ? (
                        <Badge variant="success">done</Badge>
                      ) : l.level === r.currentLevel ? (
                        <Badge variant="warning">current</Badge>
                      ) : (
                        <Badge variant="neutral">waiting</Badge>
                      )}
                    </div>
                    <p className="text-slate-500 mt-1">
                      Needs {l.requiredApprovals} approval(s)
                      {l.approverRole ? ` · role ${l.approverRole}` : ''}
                      {l.skippedByAmount ? ' · skipped (below floor)' : ''}
                    </p>
                    {(l.approvals || []).map((a: any, x: number) => (
                      <p key={x} className="text-slate-400 mt-1">
                        {a.decision === 'APPROVED' ? '✅' : a.decision === 'REJECTED' ? '⛔' : '↩︎'} {a.byName || 'user'} ·{' '}
                        {new Date(a.at).toLocaleString()}
                        {a.comment ? ` — "${a.comment}"` : ''}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              {r.notes && <p className="text-[11px] text-slate-500 mt-2">Note: {r.notes}</p>}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Approvals</h1>
            <p className="text-xs text-slate-400">
              Multi-tier approval inbox for purchase orders, expenses and letters of credit
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {tab === 'workflows' && (
            <Button size="sm" onClick={() => setWfModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New Workflow
            </Button>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'inbox', label: 'My Inbox', icon: <Clock className="w-3.5 h-3.5" />, count: inboxRows.length },
          { key: 'all', label: 'All Requests', icon: <CheckSquare className="w-3.5 h-3.5" /> },
          { key: 'workflows', label: 'Workflow Setup', icon: <GitBranch className="w-3.5 h-3.5" />, count: workflows.length },
        ]}
        activeTab={tab}
        onChange={(k) => setTab(k as Tab)}
        variant="pills"
      />

      {tab === 'inbox' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Awaiting Me" value={String(inbox?.summary?.awaitingMe ?? 0)} tone="amber" />
            <KpiCard label="Value Waiting" value={money(inbox?.summary?.awaitingMeValue)} tone="white" />
            <KpiCard label="Oldest Request" value={`${inbox?.summary?.oldestWaitingDays ?? 0} days`} tone="rose" />
            <KpiCard label="Total In Chains" value={String(inbox?.summary?.totalPending ?? 0)} tone="indigo" />
          </div>
          <ReportTable
            headers={[
              { label: 'Document' },
              { label: 'Title' },
              { label: 'Amount', align: 'right' },
              { label: 'Level', align: 'center' },
              { label: 'Requested By' },
              { label: 'Waiting', align: 'center' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' },
            ]}
            isEmpty={!inboxLoading && inboxRows.length === 0}
            empty="Nothing waiting for you — the inbox is clear."
          >
            {inboxRows.map(renderRequestRow)}
          </ReportTable>
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
            >
              {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All statuses'}
                </option>
              ))}
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
            >
              <option value="">All document types</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <ReportTable
            headers={[
              { label: 'Document' },
              { label: 'Title' },
              { label: 'Amount', align: 'right' },
              { label: 'Level', align: 'center' },
              { label: 'Requested By' },
              { label: 'Waiting', align: 'center' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' },
            ]}
            isEmpty={!requestsLoading && rows.length === 0}
            empty="No approval requests match this filter."
          >
            {rows.map(renderRequestRow)}
          </ReportTable>
        </div>
      )}

      {tab === 'workflows' && (
        <ReportTable
          headers={[
            { label: 'Workflow' },
            { label: 'Document' },
            { label: 'Amount Range', align: 'right' },
            { label: 'Chain' },
            { label: 'Status', align: 'center' },
            { label: 'Actions', align: 'right' },
          ]}
          isEmpty={workflows.length === 0}
          empty="No workflow configured yet — without one, documents follow their normal rules."
        >
          {workflows.map((w) => (
            <tr key={w._id} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white font-medium">
                {w.name}
                {w.description ? <span className="block text-[10px] text-slate-500">{w.description}</span> : null}
              </td>
              <td className="py-2.5 px-4 text-slate-400">{ENTITY_LABELS[w.entityType] || w.entityType}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">
                {money(w.minAmount)}
                {w.maxAmount ? ` – ${money(w.maxAmount)}` : ' +'}
              </td>
              <td className="py-2.5 px-4">
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  {(w.levels || []).map((l: any, i: number) => (
                    <span key={l.level} className="inline-flex items-center gap-1">
                      {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {l.name}
                        {l.approverRole ? ` · ${l.approverRole}` : ''}
                        {l.requiredApprovals > 1 ? ` ×${l.requiredApprovals}` : ''}
                      </span>
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-2.5 px-4 text-center">
                <Badge variant={w.isActive ? 'success' : 'neutral'}>{w.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="py-2.5 px-4 text-right">
                <button
                  onClick={() => {
                    if (confirm(`Delete workflow "${w.name}"?`)) deleteWfMutation.mutate(w._id);
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </ReportTable>
      )}

      {/* Decision modal */}
      <Modal
        isOpen={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? `Approve ${decision?.ref}` : `Reject ${decision?.ref}`}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            {decision?.action === 'approve'
              ? 'Approving moves the document to the next level, or finalises it when this was the last level.'
              : 'Rejecting closes the chain and the document is marked rejected.'}
          </p>
          <div>
            <label className="text-xs text-slate-400">Comment {decision?.action === 'reject' ? '(recommended)' : '(optional)'}</label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason / remark" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                decision && decideMutation.mutate({ id: decision.id, action: decision.action, comment: comment || undefined })
              }
              disabled={decideMutation.isPending || (decision?.action === 'reject' && !comment.trim())}
            >
              {decideMutation.isPending ? 'Saving…' : decision?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create workflow modal */}
      <Modal isOpen={wfModal} onClose={() => setWfModal(false)} title="New approval workflow" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Workflow name *</label>
              <Input
                value={wfForm.name}
                onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })}
                placeholder="Purchase orders above ৳50,000"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Applies to</label>
              <select
                value={wfForm.entityType}
                onChange={(e) => setWfForm({ ...wfForm, entityType: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">From amount</label>
                <Input
                  type="number"
                  value={wfForm.minAmount}
                  onChange={(e) => setWfForm({ ...wfForm, minAmount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Up to (blank = no limit)</label>
                <Input
                  type="number"
                  value={wfForm.maxAmount}
                  onChange={(e) => setWfForm({ ...wfForm, maxAmount: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Approval levels (in order)</label>
              <button
                onClick={() =>
                  setWfForm({
                    ...wfForm,
                    levels: [
                      ...wfForm.levels,
                      { name: '', approverRole: 'ADMIN', requiredApprovals: '1', skipBelowAmount: '' },
                    ],
                  })
                }
                className="text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                + Add level
              </button>
            </div>
            <div className="space-y-2 mt-1">
              {wfForm.levels.map((l, i) => (
                <div key={i} className="rounded-lg border border-slate-800 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 w-14">Level {i + 1}</span>
                    <Input
                      value={l.name}
                      onChange={(e) => {
                        const next = [...wfForm.levels];
                        next[i] = { ...next[i], name: e.target.value };
                        setWfForm({ ...wfForm, levels: next });
                      }}
                      placeholder="e.g. Manager review"
                    />
                    <button
                      onClick={() => setWfForm({ ...wfForm, levels: wfForm.levels.filter((_, x) => x !== i) })}
                      className="text-slate-500 hover:text-rose-400 px-1"
                      disabled={wfForm.levels.length === 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400">Approver role</label>
                      <select
                        value={l.approverRole}
                        onChange={(e) => {
                          const next = [...wfForm.levels];
                          next[i] = { ...next[i], approverRole: e.target.value };
                          setWfForm({ ...wfForm, levels: next });
                        }}
                        className="w-full px-2 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 text-slate-200"
                      >
                        <option value="">— any —</option>
                        {['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Approvals needed</label>
                      <Input
                        type="number"
                        value={l.requiredApprovals}
                        onChange={(e) => {
                          const next = [...wfForm.levels];
                          next[i] = { ...next[i], requiredApprovals: e.target.value };
                          setWfForm({ ...wfForm, levels: next });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Skip below amount</label>
                      <Input
                        type="number"
                        value={l.skipBelowAmount}
                        onChange={(e) => {
                          const next = [...wfForm.levels];
                          next[i] = { ...next[i], skipBelowAmount: e.target.value };
                          setWfForm({ ...wfForm, levels: next });
                        }}
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 text-[11px] text-indigo-200">
            A document is routed into this chain only when its amount falls inside the range above and a workflow
            exists — otherwise the module keeps its default behaviour.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWfModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createWfMutation.mutate()}
              disabled={!wfForm.name.trim() || wfForm.levels.some((l) => !l.name.trim()) || createWfMutation.isPending}
            >
              {createWfMutation.isPending ? 'Creating…' : 'Create workflow'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
