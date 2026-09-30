'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Plus, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { Tabs } from '../../../../components/ui/Tabs';
import { useToast } from '../../../../components/ui/Toast';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { ReportTable } from '../../../../components/reports/ReportShell';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'ANNUAL', 'UNPAID', 'MATERNITY', 'OTHER'];

export default function LeavePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'all' | 'summary'>('pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'CASUAL', fromDate: '', toDate: '', reason: '' });

  const { data: list, isLoading } = useQuery<any>({
    queryKey: ['leave-requests', tab],
    queryFn: async () => (await api.get('/leave-requests', { params: { status: tab === 'pending' ? 'PENDING' : undefined, limit: 200 } })).data,
  });

  const { data: summary } = useQuery<any>({
    queryKey: ['leave-summary'],
    queryFn: async () => (await api.get('/leave-requests/summary')).data,
    enabled: tab === 'summary',
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees-for-leave'],
    queryFn: async () => {
      const res = await api.get('/hr/employees', { params: { limit: 200 } });
      return (Array.isArray(res.data) ? res.data : (res.data as any)?.data) || [];
    },
    enabled: modalOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post('/leave-requests', form),
    onSuccess: () => {
      toast.success('Leave request submitted');
      setModalOpen(false);
      setForm({ employeeId: '', leaveType: 'CASUAL', fromDate: '', toDate: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not submit the request'),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      api.put(`/leave-requests/${id}/${action}`, { note }),
    onSuccess: (res: any, vars) => {
      toast.success(
        vars.action === 'approve'
          ? `Approved — ${res.data?.attendanceMarkedDays ?? 0} day(s) marked as leave in attendance`
          : 'Leave rejected'
      );
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-summary'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not record the decision'),
  });

  const rows: any[] = list?.data || [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <CalendarOff className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Leave Requests</h1>
            <p className="text-xs text-slate-400">
              Approving a request also marks those days as leave in attendance, so payroll never calls it absence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Request
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'pending', label: 'Pending', count: list?.summary?.pending },
          { key: 'all', label: 'All Requests', count: list?.summary?.total },
          { key: 'summary', label: 'Leave Summary' },
        ]}
        activeTab={tab}
        onChange={(k) => setTab(k as any)}
        variant="pills"
      />

      {tab !== 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Pending" value={String(list?.summary?.pending ?? 0)} tone="amber" />
            <KpiCard label="Approved" value={String(list?.summary?.approved ?? 0)} tone="emerald" />
            <KpiCard label="Rejected" value={String(list?.summary?.rejected ?? 0)} tone="rose" />
            <KpiCard label="Approved Days" value={String(list?.summary?.approvedDays ?? 0)} tone="white" />
          </div>

          <ReportTable
            headers={[
              { label: 'Request' },
              { label: 'Employee' },
              { label: 'Type', align: 'center' },
              { label: 'Period' },
              { label: 'Days', align: 'right' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' },
            ]}
            isEmpty={!isLoading && rows.length === 0}
            empty={tab === 'pending' ? 'No leave request waiting for approval.' : 'No leave requests yet.'}
          >
            {rows.map((r) => (
              <tr key={r._id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4">
                  <span className="font-mono text-[11px] text-white">{r.requestNo}</span>
                  {r.reason ? <span className="block text-[10px] text-slate-500 max-w-[200px] truncate">{r.reason}</span> : null}
                </td>
                <td className="py-2.5 px-4 text-slate-300">
                  {r.employeeId?.name || '—'}
                  <span className="block text-[10px] text-slate-500">
                    {r.employeeId?.employeeCode} {r.employeeId?.department ? `· ${r.employeeId.department}` : ''}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <Badge variant="neutral">{r.leaveType}</Badge>
                </td>
                <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                  {r.fromDate} → {r.toDate}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-300">{r.days}</td>
                <td className="py-2.5 px-4 text-center">
                  <Badge
                    variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : r.status === 'CANCELLED' ? 'neutral' : 'warning'}
                  >
                    {r.status}
                  </Badge>
                  {r.approvedById?.fullName ? (
                    <span className="block text-[10px] text-slate-500 mt-1">by {r.approvedById.fullName}</span>
                  ) : null}
                </td>
                <td className="py-2.5 px-4">
                  {r.status === 'PENDING' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => decideMutation.mutate({ id: r._id, action: 'approve', note: 'Approved from the leave board' })}
                        className="px-2 py-1 rounded text-[11px] text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Reason for rejection (optional)') || undefined;
                          decideMutation.mutate({ id: r._id, action: 'reject', note });
                        }}
                        className="px-2 py-1 rounded text-[11px] text-rose-400 hover:bg-slate-800 inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 block text-right">
                      {r.attendanceMarked ? 'attendance marked' : r.decidedAt ? new Date(r.decidedAt).toLocaleDateString() : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      {tab === 'summary' && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Employees On Leave" value={String(summary.summary?.employees ?? 0)} tone="indigo" />
            <KpiCard label="Total Leave Days" value={String(summary.summary?.totalDays ?? 0)} tone="white" />
            <KpiCard label="Avg Days / Employee" value={String(summary.summary?.averageDaysPerEmployee ?? 0)} tone="amber" />
            <KpiCard
              label="Most Common Type"
              value={Object.entries(summary.summary?.byType || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '—'}
              tone="emerald"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Days by leave type</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.summary?.byType || {}).map(([type, days]) => (
                <span key={type} className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-slate-300">
                  {type}: <span className="text-white font-semibold">{days as number}</span>
                </span>
              ))}
            </div>
          </div>

          <ReportTable
            headers={[
              { label: 'Employee' },
              { label: 'Code' },
              { label: 'Department' },
              { label: 'Days', align: 'right' },
              { label: 'Requests', align: 'right' },
              { label: 'Breakdown' },
            ]}
            isEmpty={!(summary.data || []).length}
            empty="No approved leave in this period."
          >
            {(summary.data || []).map((r: any) => (
              <tr key={r.employeeId} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 text-white font-medium">{r.employeeName}</td>
                <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{r.employeeCode}</td>
                <td className="py-2.5 px-4 text-slate-400">{r.department}</td>
                <td className="py-2.5 px-4 text-right text-amber-400 font-semibold">{r.days}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{r.requests}</td>
                <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                  {Object.entries(r.byType).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </td>
              </tr>
            ))}
          </ReportTable>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New leave request">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Employee *</label>
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
            >
              <option value="">Select employee</option>
              {employees.map((e: any) => (
                <option key={e._id} value={e._id}>
                  {e.name} {e.employeeCode ? `(${e.employeeCode})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Reason</label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">From *</label>
              <Input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">To *</label>
              <Input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.employeeId || !form.fromDate || !form.toDate || createMutation.isPending}
            >
              {createMutation.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
