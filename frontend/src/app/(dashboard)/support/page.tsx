'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Plus, RefreshCw, X, MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { KpiCard } from '../../../components/reports/KpiCard';
import { ReportTable } from '../../../components/reports/ReportShell';

const STATUS_TABS = ['', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const statusVariant = (s: string) =>
  s === 'RESOLVED' || s === 'CLOSED'
    ? 'success'
    : s === 'OPEN'
    ? 'warning'
    : s === 'IN_PROGRESS'
    ? 'info'
    : 'neutral';

export default function SupportPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'open' | 'all' | 'sla'>('open');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [reply, setReply] = useState('');
  const [resolveForm, setResolveForm] = useState({ resolution: '', satisfactionRating: '' });
  const [form, setForm] = useState({ subject: '', description: '', priority: 'NORMAL', category: '', customerName: '', customerPhone: '', relatedOrderNo: '' });

  const listEndpoint = tab === 'open' ? '/support-tickets?status=OPEN&limit=200' : `/support-tickets?${statusFilter ? `status=${statusFilter}&` : ''}limit=200`;

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ['support-tickets', tab, statusFilter],
    queryFn: async () => (await api.get(listEndpoint)).data || [],
    enabled: tab !== 'sla',
  });

  const { data: sla } = useQuery<any>({
    queryKey: ['ticket-sla'],
    queryFn: async () => (await api.get('/support-tickets/report/sla')).data,
    enabled: tab === 'sla',
  });

  const { data: ticketDetail } = useQuery<any>({
    queryKey: ['support-ticket', detail?._id],
    queryFn: async () => (await api.get(`/support-tickets/${detail!._id}`)).data,
    enabled: !!detail,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post('/support-tickets', form),
    onSuccess: () => {
      toast.success('Ticket created — the SLA clock has started');
      setCreateOpen(false);
      setForm({ subject: '', description: '', priority: 'NORMAL', category: '', customerName: '', customerPhone: '', relatedOrderNo: '' });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the ticket'),
  });

  const replyMutation = useMutation({
    mutationFn: async () => api.post(`/support-tickets/${detail._id}/responses`, { message: reply, isCustomerVisible: true }),
    onSuccess: (res: any) => {
      const met = res.data?.slaMet;
      if (met === false) toast.info('Reply sent — this first response was past its SLA');
      else toast.success('Reply sent');
      setReply('');
      qc.invalidateQueries({ queryKey: ['support-ticket'] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket-sla'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not send the reply'),
  });

  const resolveMutation = useMutation({
    mutationFn: async () =>
      api.post(`/support-tickets/${detail._id}/resolve`, {
        resolution: resolveForm.resolution,
        satisfactionRating: resolveForm.satisfactionRating ? Number(resolveForm.satisfactionRating) : undefined,
      }),
    onSuccess: () => {
      toast.success('Ticket resolved');
      setResolveForm({ resolution: '', satisfactionRating: '' });
      qc.invalidateQueries({ queryKey: ['support-ticket'] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket-sla'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not resolve the ticket'),
  });

  const breached = (t: any) => t.isBreached;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <LifeBuoy className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Support Tickets</h1>
            <p className="text-xs text-slate-400">Customer complaints with a response-time SLA</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Ticket
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'open', label: 'Open' },
          { key: 'all', label: 'All Tickets' },
          { key: 'sla', label: 'SLA Report' },
        ]}
        activeTab={tab}
        onChange={(k) => setTab(k as any)}
        variant="pills"
      />

      {tab !== 'sla' && (
        <div className="space-y-4">
          {tab === 'all' && (
            <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1 w-fit">
              {STATUS_TABS.map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-md ${statusFilter === s ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {s ? s.replace('_', ' ') : 'Any'}
                </button>
              ))}
            </div>
          )}

          <ReportTable
            headers={[
              { label: 'Ticket' },
              { label: 'Customer' },
              { label: 'Priority', align: 'center' },
              { label: 'SLA' },
              { label: 'Assigned' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' },
            ]}
            isEmpty={!isLoading && tickets.length === 0}
            empty="No tickets — customers are happy."
          >
            {tickets.map((t) => (
              <tr key={t._id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4">
                  <button onClick={() => setDetail(t)} className="text-left">
                    <span className="font-mono text-[11px] text-white">{t.ticketNo}</span>
                    <span className="block text-xs text-slate-300 max-w-[260px] truncate">{t.subject}</span>
                  </button>
                </td>
                <td className="py-2.5 px-4 text-slate-400">
                  {t.customerName || t.customerId?.name || '—'}
                  <span className="block text-[10px] text-slate-500">{t.customerPhone || t.customerId?.phone || ''}</span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <Badge variant={t.priority === 'URGENT' ? 'danger' : t.priority === 'HIGH' ? 'warning' : 'neutral'}>{t.priority}</Badge>
                </td>
                <td className="py-2.5 px-4">
                  {breached(t) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                      <AlertTriangle className="w-3 h-3" /> overdue {Math.abs(t.hoursToSla ?? 0)}h
                    </span>
                  ) : t.firstResponseAt ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> answered in {t.responseHours}h
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-400">due in {t.hoursToSla}h</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-slate-400">{t.assigneeId?.fullName || 'Unassigned'}</td>
                <td className="py-2.5 px-4 text-center">
                  <Badge variant={statusVariant(t.status) as any}>{t.status.replace('_', ' ')}</Badge>
                </td>
                <td className="py-2.5 px-4 text-right">
                  <button onClick={() => setDetail(t)} className="px-2 py-1 rounded text-[11px] text-rose-400 hover:bg-slate-800">
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      {tab === 'sla' && sla && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard label="Tickets" value={String(sla.summary?.tickets ?? 0)} tone="indigo" />
            <KpiCard
              label="SLA Compliance"
              value={sla.summary?.slaCompliancePercent === null ? '—' : `${sla.summary?.slaCompliancePercent}%`}
              tone="emerald"
              hint="Answered within the target"
            />
            <KpiCard label="Currently Overdue" value={String(sla.summary?.currentlyOverdue ?? 0)} tone="rose" />
            <KpiCard label="Avg First Response" value={sla.summary?.averageResponseHours === null ? '—' : `${sla.summary?.averageResponseHours}h`} tone="white" />
            <KpiCard
              label="Avg Resolution"
              value={sla.summary?.averageResolutionHours === null ? '—' : `${sla.summary?.averageResolutionHours}h`}
              tone="amber"
              hint={sla.summary?.averageRating ? `Rating ${sla.summary.averageRating}/5` : undefined}
            />
          </div>

          <ReportTable
            headers={[
              { label: 'Priority' },
              { label: 'Tickets', align: 'right' },
              { label: 'Answered', align: 'right' },
              { label: 'Breached', align: 'right' },
              { label: 'Compliance %', align: 'right' },
            ]}
            isEmpty={!(sla.byPriority || []).length}
            empty="No tickets in this period."
          >
            {(sla.byPriority || []).map((p: any) => (
              <tr key={p.priority} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 text-white font-medium">{p.priority}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{p.tickets}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{p.responded}</td>
                <td className="py-2.5 px-4 text-right text-rose-400">{p.breached}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{p.compliancePercent === null ? '—' : `${p.compliancePercent}%`}</td>
              </tr>
            ))}
          </ReportTable>

          {(sla.byAgent || []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Workload by agent</h3>
              <ReportTable
                headers={[
                  { label: 'Agent' },
                  { label: 'Assigned', align: 'right' },
                  { label: 'Resolved', align: 'right' },
                  { label: 'Breached', align: 'right' },
                ]}
                isEmpty={false}
              >
                {sla.byAgent.map((a: any) => (
                  <tr key={a.agent} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 text-white">{a.agent}</td>
                    <td className="py-2.5 px-4 text-right text-slate-300">{a.assigned}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-400">{a.resolved}</td>
                    <td className="py-2.5 px-4 text-right text-rose-400">{a.breached}</td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New support ticket" size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Subject *</label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Damaged item received" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Description *</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Response target: URGENT 2h · HIGH 8h · NORMAL 24h · LOW 72h
              </p>
            </div>
            <div>
              <label className="text-xs text-slate-400">Category</label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Delivery / Product / Billing" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Customer name</label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Customer phone</label>
              <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Related order / invoice</label>
              <Input value={form.relatedOrderNo} onChange={(e) => setForm({ ...form, relatedOrderNo: e.target.value })} placeholder="WEB-000123 or INV-..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.subject.trim() || !form.description.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create ticket'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{detail.subject}</h3>
                <p className="text-xs text-slate-400 font-mono">{detail.ticketNo}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(detail.status) as any}>{detail.status.replace('_', ' ')}</Badge>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Priority" value={detail.priority} tone="amber" hint={`Respond within ${detail.slaHours}h`} />
                <KpiCard
                  label={detail.firstResponseAt ? 'First response' : 'SLA due'}
                  value={detail.firstResponseAt ? `${((new Date(detail.firstResponseAt).getTime() - new Date(detail.createdAt).getTime()) / 3600000).toFixed(1)}h` : new Date(detail.slaDueAt).toLocaleString()}
                  tone={detail.firstResponseAt ? 'emerald' : 'rose'}
                  hint={detail.resolution ? 'Resolved' : undefined}
                />
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
                <p className="text-[10px] uppercase text-slate-500 mb-1">Description</p>
                {detail.description}
                {detail.resolution && (
                  <>
                    <p className="text-[10px] uppercase text-emerald-400 mt-3 mb-1">Resolution</p>
                    {detail.resolution}
                  </>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Conversation ({(ticketDetail?.responses || []).length})
                </p>
                <div className="space-y-2">
                  {(ticketDetail?.responses || []).length === 0 && (
                    <p className="text-[11px] text-slate-500">No replies yet — the SLA clock is still running.</p>
                  )}
                  {(ticketDetail?.responses || []).map((r: any, i: number) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{r.byName || 'Staff'}</span>
                        <span>{new Date(r.at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{r.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {['RESOLVED', 'CLOSED'].includes(detail.status) ? (
                <p className="text-[11px] text-emerald-400">This ticket is {detail.status.toLowerCase()}.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Reply to the customer</label>
                    <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your response…" />
                    <Button onClick={() => replyMutation.mutate()} disabled={!reply.trim() || replyMutation.isPending}>
                      {replyMutation.isPending ? 'Sending…' : 'Send reply'}
                    </Button>
                  </div>
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <label className="text-xs text-slate-400">Resolve ticket</label>
                    <Input
                      value={resolveForm.resolution}
                      onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}
                      placeholder="What fixed it?"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={resolveForm.satisfactionRating}
                        onChange={(e) => setResolveForm({ ...resolveForm, satisfactionRating: e.target.value })}
                        className="px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                      >
                        <option value="">No rating</option>
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>
                            {'★'.repeat(r)}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={() => resolveMutation.mutate()}
                        disabled={!resolveForm.resolution.trim() || resolveMutation.isPending}
                      >
                        {resolveMutation.isPending ? 'Saving…' : 'Mark resolved'}
                      </Button>
                    </div>
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
