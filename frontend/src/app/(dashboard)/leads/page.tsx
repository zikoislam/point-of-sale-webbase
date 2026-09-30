'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, RefreshCw, Phone, CalendarClock, UserPlus, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { KpiCard } from '../../../components/reports/KpiCard';
import { money } from '../../../components/reports/ReportShell';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
const SOURCES = ['WALK_IN', 'PHONE', 'REFERRAL', 'FACEBOOK', 'ONLINE_STORE', 'EXHIBITION', 'OTHER'];

const stageTint: Record<string, string> = {
  NEW: 'border-slate-700',
  CONTACTED: 'border-sky-500/40',
  QUALIFIED: 'border-indigo-500/40',
  PROPOSAL: 'border-amber-500/40',
  WON: 'border-emerald-500/50',
  LOST: 'border-rose-500/40',
};

export default function LeadsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [includeClosed, setIncludeClosed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', company: '', source: 'WALK_IN', estimatedValue: '', interestedIn: '', nextFollowUpAt: '' });
  const [dragLead, setDragLead] = useState<string | null>(null);

  const { data: board, isLoading } = useQuery<any>({
    queryKey: ['lead-board', includeClosed],
    queryFn: async () => (await api.get('/leads/board', { params: { includeClosed: includeClosed ? 'true' : undefined } })).data,
  });

  const { data: report } = useQuery<any>({
    queryKey: ['lead-conversion'],
    queryFn: async () => (await api.get('/leads/report/conversion')).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post('/leads', {
        ...form,
        estimatedValue: Number(form.estimatedValue) || 0,
        nextFollowUpAt: form.nextFollowUpAt || undefined,
      }),
    onSuccess: () => {
      toast.success('Lead added to the pipeline');
      setCreateOpen(false);
      setForm({ name: '', phone: '', company: '', source: 'WALK_IN', estimatedValue: '', interestedIn: '', nextFollowUpAt: '' });
      qc.invalidateQueries({ queryKey: ['lead-board'] });
      qc.invalidateQueries({ queryKey: ['lead-conversion'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the lead'),
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage, note }: { id: string; stage: string; note?: string }) =>
      api.put(`/leads/${id}/stage`, { stage, note }),
    onSuccess: (res: any) => {
      toast.success(`Lead moved to ${res.data?.stage}`);
      qc.invalidateQueries({ queryKey: ['lead-board'] });
      qc.invalidateQueries({ queryKey: ['lead-conversion'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not move the lead'),
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/leads/${id}/convert`, { customerType: 'RETAIL' }),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Lead converted');
      qc.invalidateQueries({ queryKey: ['lead-board'] });
      qc.invalidateQueries({ queryKey: ['lead-conversion'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not convert the lead'),
  });

  const followUpMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => api.post(`/leads/${id}/follow-up`, { note }),
    onSuccess: () => {
      toast.success('Follow-up logged');
      qc.invalidateQueries({ queryKey: ['lead-board'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not log the follow-up'),
  });

  const columns = board?.columns || [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
            <Target className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Lead Pipeline</h1>
            <p className="text-xs text-slate-400">
              Drag a card — or use the arrows — to move a lead forward, then convert it into a customer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400 mr-1">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            Show won/lost
          </label>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Open Leads" value={String(board?.summary?.open ?? 0)} tone="indigo" />
        <KpiCard label="Pipeline Value" value={money(board?.summary?.pipelineValue)} tone="white" hint={`Weighted ${money(board?.summary?.weightedPipelineValue)}`} />
        <KpiCard
          label="Conversion Rate"
          value={report?.summary?.conversionRatePercent === null ? '—' : `${report?.summary?.conversionRatePercent ?? '—'}%`}
          tone="emerald"
          hint={`${report?.summary?.won ?? 0} won · ${report?.summary?.lost ?? 0} lost`}
        />
        <KpiCard label="Won Value" value={money(report?.summary?.wonValue)} tone="emerald" />
        <KpiCard
          label="Follow-ups Overdue"
          value={String(board?.summary?.overdueFollowUps ?? 0)}
          tone="rose"
          hint={`${board?.summary?.dueTodayFollowUps ?? 0} due today`}
        />
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-500">Loading pipeline…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((col: any) => (
            <div
              key={col.stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragLead) {
                  stageMutation.mutate({ id: dragLead, stage: col.stage, note: 'Moved on the board' });
                  setDragLead(null);
                }
              }}
              className={`w-72 shrink-0 rounded-2xl border bg-slate-900/60 ${stageTint[col.stage] || 'border-slate-800'}`}
            >
              <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{col.stage}</p>
                  <p className="text-[10px] text-slate-500">
                    {col.count} lead(s) · {money(col.value)}
                  </p>
                </div>
                <Badge variant="neutral">{col.count}</Badge>
              </div>

              <div className="p-2 space-y-2 min-h-[80px]">
                {col.cards.length === 0 && <p className="text-[11px] text-slate-600 px-1 py-2">Drop a lead here</p>}
                {col.cards.map((card: any) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragLead(card.id)}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{card.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {card.leadNo}
                          {card.company ? ` · ${card.company}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{card.probability}%</span>
                    </div>

                    <p className="text-xs text-emerald-400 font-semibold mt-1.5">{money(card.estimatedValue)}</p>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {card.phone}
                      </span>
                      {card.overdueFollowUp && (
                        <span className="inline-flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="w-3 h-3" /> overdue
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Assigned: {card.assignedTo}</p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {STAGES.indexOf(col.stage) < STAGES.indexOf('WON') && col.stage !== 'LOST' && (
                        <button
                          onClick={() => stageMutation.mutate({ id: card.id, stage: STAGES[STAGES.indexOf(col.stage) + 1], note: 'Advanced' })}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-white"
                        >
                          →
                        </button>
                      )}
                      <button
                        onClick={() => followUpMutation.mutate({ id: card.id, note: 'Follow-up logged from the board' })}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700 inline-flex items-center gap-1"
                      >
                        <CalendarClock className="w-3 h-3" /> Follow up
                      </button>
                      {col.stage !== 'WON' && col.stage !== 'LOST' && (
                        <button
                          onClick={() => convertMutation.mutate(card.id)}
                          className="px-2 py-0.5 rounded text-[10px] bg-emerald-600 text-white hover:bg-emerald-500 inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> Convert
                        </button>
                      )}
                      {col.stage !== 'WON' && col.stage !== 'LOST' && (
                        <button
                          onClick={() => {
                            const reason = prompt('Why was this lead lost?') || undefined;
                            stageMutation.mutate({ id: card.id, stage: 'LOST', note: reason });
                          }}
                          className="px-2 py-0.5 rounded text-[10px] text-rose-400 hover:bg-slate-800"
                        >
                          Lost
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(report?.bySource || []).length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Which channel actually converts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.bySource.map((s: any) => (
              <div key={s.source} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{s.source.replace(/_/g, ' ')}</span>
                  <Badge variant={s.conversionRatePercent >= 50 ? 'success' : s.conversionRatePercent > 0 ? 'warning' : 'neutral'}>
                    {s.conversionRatePercent}%
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {s.leads} lead(s) · {s.won} won · {money(s.wonValue)} won value
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New lead">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Phone *</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Company</label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Estimated value (BDT)</label>
              <Input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Next follow-up</label>
              <Input type="date" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Interested in</label>
              <Input value={form.interestedIn} onChange={(e) => setForm({ ...form, interestedIn: e.target.value })} placeholder="e.g. 500 yards cotton fabric" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.phone.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Add lead'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
