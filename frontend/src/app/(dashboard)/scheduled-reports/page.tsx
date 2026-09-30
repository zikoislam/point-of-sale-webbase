'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  X,
  Mail,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { KpiCard } from '../../../components/reports/KpiCard';
import { ReportTable } from '../../../components/reports/ReportShell';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ReportOption {
  type: string;
  title: string;
  dated: boolean;
}

export default function ScheduledReportsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    reportType: 'daily-register',
    frequency: 'DAILY',
    timeOfDay: '08:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    periodDays: 1,
    recipients: '',
    format: 'PDF' as 'PDF' | 'EXCEL',
  });

  const { data: options } = useQuery<{ emailConfigured: boolean; reportTypes: ReportOption[] }>({
    queryKey: ['scheduled-report-options'],
    queryFn: async () =>
      (await api.get('/scheduled-reports/options')).data as any,
  });

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ['scheduled-reports'],
    queryFn: async () => (await api.get('/scheduled-reports')).data || [],
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post('/scheduled-reports', {
        name: form.name,
        reportType: form.reportType,
        frequency: form.frequency,
        timeOfDay: form.timeOfDay,
        dayOfWeek: form.frequency === 'WEEKLY' ? Number(form.dayOfWeek) : null,
        dayOfMonth: form.frequency === 'MONTHLY' ? Number(form.dayOfMonth) : null,
        periodDays: Number(form.periodDays) || 1,
        recipients: form.recipients
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        format: form.format,
      }),
    onSuccess: () => {
      toast.success('Scheduled report created');
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the schedule'),
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/scheduled-reports/${id}/run`),
    onSuccess: (res: any) => {
      const d = res.data;
      if (d?.status === 'SUCCESS') toast.success(`${d.attachment} emailed to ${d.recipients.join(', ')}`);
      else if (d?.status === 'SKIPPED') toast.info(`Report built (${d.attachment}) — email skipped: ${d.error}`);
      else toast.error(d?.error || 'Run failed');
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not run the report'),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => api.put(`/scheduled-reports/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not update the schedule'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/scheduled-reports/${id}`),
    onSuccess: () => {
      toast.success('Schedule deleted');
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not delete the schedule'),
  });

  const active = reports.filter((r) => r.isActive);
  const next = active
    .map((r) => r.nextRunAt)
    .filter(Boolean)
    .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime())[0];

  const describe = (r: any) => {
    if (r.frequency === 'DAILY') return `Every day at ${r.timeOfDay}`;
    if (r.frequency === 'WEEKLY') return `Every ${WEEKDAYS[r.dayOfWeek ?? 0]} at ${r.timeOfDay}`;
    return `Day ${r.dayOfMonth} of each month at ${r.timeOfDay}`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30">
            <CalendarClock className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Scheduled Reports</h1>
            <p className="text-xs text-slate-400">
              Email daily, weekly or monthly reports to management automatically
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Schedule
          </Button>
        </div>
      </div>

      {options && !options.emailConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <p className="font-semibold">Email is not configured on this server.</p>
            <p className="mt-1">
              The reports will still be generated (and you can run them on demand), but nothing can be delivered until
              SMTP or an email API key is set in the environment.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Schedules" value={String(reports.length)} tone="indigo" />
        <KpiCard label="Active" value={String(active.length)} tone="emerald" />
        <KpiCard
          label="Next Delivery"
          value={next ? new Date(next).toLocaleString() : '—'}
          tone="white"
          hint={next ? undefined : 'Nothing scheduled'}
        />
        <KpiCard
          label="Email"
          value={options?.emailConfigured ? 'Ready' : 'Not configured'}
          tone={options?.emailConfigured ? 'emerald' : 'amber'}
          hint={options?.emailConfigured ? 'SMTP / API key present' : 'Reports build but are not sent'}
        />
      </div>

      <ReportTable
        headers={[
          { label: 'Schedule' },
          { label: 'Report' },
          { label: 'When' },
          { label: 'Recipients' },
          { label: 'Format', align: 'center' },
          { label: 'Last Run', align: 'center' },
          { label: 'Next Run', align: 'center' },
          { label: 'Actions', align: 'right' },
        ]}
        isEmpty={!isLoading && reports.length === 0}
        empty="No scheduled report yet — add one to get a daily or weekly summary by email."
      >
        {reports.map((r) => (
          <tr key={r._id} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4">
              <button onClick={() => setDetail(r)} className="text-left">
                <span className="text-white font-medium">{r.name}</span>
                <span className="block text-[10px] text-slate-500">
                  {r.runCount} run(s) · last {r.lastRunAt ? new Date(r.lastRunAt).toLocaleDateString() : 'never'}
                </span>
              </button>
            </td>
            <td className="py-2.5 px-4 text-slate-400">
              {r.reportType}
              <span className="block text-[10px] text-slate-500">last {r.periodDays} day(s)</span>
            </td>
            <td className="py-2.5 px-4 text-slate-300">{describe(r)}</td>
            <td className="py-2.5 px-4 text-slate-400 max-w-[220px] truncate">{r.recipients.join(', ')}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant="neutral">{r.format}</Badge>
            </td>
            <td className="py-2.5 px-4 text-center">
              {r.lastRunStatus ? (
                <Badge variant={r.lastRunStatus === 'SUCCESS' ? 'success' : r.lastRunStatus === 'SKIPPED' ? 'warning' : 'danger'}>
                  {r.lastRunStatus}
                </Badge>
              ) : (
                <span className="text-[11px] text-slate-500">not yet</span>
              )}
            </td>
            <td className="py-2.5 px-4 text-center text-[11px] text-slate-400">
              {r.isActive && r.nextRunAt ? new Date(r.nextRunAt).toLocaleString() : 'paused'}
            </td>
            <td className="py-2.5 px-4">
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => runMutation.mutate(r._id)}
                  className="px-2 py-1 rounded text-[11px] text-sky-400 hover:bg-slate-800 inline-flex items-center gap-1"
                  title="Run now"
                >
                  <Play className="w-3 h-3" /> Run
                </button>
                <button
                  onClick={() => toggleMutation.mutate(r._id)}
                  className="p-1.5 rounded text-slate-400 hover:text-amber-400"
                  title={r.isActive ? 'Pause' : 'Resume'}
                >
                  {r.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete schedule "${r.name}"?`)) deleteMutation.mutate(r._id);
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

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New scheduled report" size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Schedule name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Daily sales to the owner"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Report *</label>
              <select
                value={form.reportType}
                onChange={(e) => setForm({ ...form, reportType: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {(options?.reportTypes || []).map((o) => (
                  <option key={o.type} value={o.type}>
                    {o.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Format</label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value as 'PDF' | 'EXCEL' })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Frequency *</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Send at *</label>
              <Input
                type="time"
                value={form.timeOfDay}
                onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })}
              />
            </div>

            {form.frequency === 'WEEKLY' && (
              <div>
                <label className="text-xs text-slate-400">Day of week</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.frequency === 'MONTHLY' && (
              <div>
                <label className="text-xs text-slate-400">Day of month (1–28)</label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400">Report window (days back)</label>
              <Input
                type="number"
                min={1}
                value={form.periodDays}
                onChange={(e) => setForm({ ...form, periodDays: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Recipients (comma separated) *</label>
            <Input
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              placeholder="owner@shop.com, accounts@shop.com"
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
            The report is generated over the last <strong>{form.periodDays || 1}</strong> day(s) and emailed with a KPI
            summary in the body. Recipients without a valid email address are ignored.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create schedule'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* History drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{detail.name}</h3>
                <p className="text-xs text-slate-400">
                  {detail.reportType} · {describe(detail)} · last {detail.periodDays} day(s)
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Mail className="w-3.5 h-3.5" />
                {detail.recipients.join(', ')}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => runMutation.mutate(detail._id)}
                  disabled={runMutation.isPending}
                >
                  <Play className="w-3.5 h-3.5 mr-1" /> Run now
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate(detail._id)}>
                  {detail.isActive ? 'Pause schedule' : 'Resume schedule'}
                </Button>
              </div>

              {detail.lastRunError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                  Last run: {detail.lastRunError}
                </div>
              )}

              <ReportTable
                headers={[
                  { label: 'When', align: 'center' },
                  { label: 'Status', align: 'center' },
                  { label: 'Attachment' },
                  { label: 'Took', align: 'right' },
                ]}
                isEmpty={!(detail.history || []).length}
                empty="This schedule has not run yet."
              >
                {(detail.history || []).map((h: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 px-4 text-center text-slate-400">
                      {new Date(h.at).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {h.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> sent
                        </span>
                      ) : h.status === 'SKIPPED' ? (
                        <span className="text-amber-400 text-[11px]">skipped</span>
                      ) : (
                        <span className="text-rose-400 text-[11px]">failed</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-slate-300 text-[11px]">
                      {h.attachment || '—'}
                      {h.error ? <span className="block text-[10px] text-slate-500">{h.error}</span> : null}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-400 text-[11px]">
                      {h.durationMs ? `${(h.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
