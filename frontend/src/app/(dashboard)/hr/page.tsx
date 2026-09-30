'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UsersRound,
  Plus,
  RefreshCw,
  CalendarCheck,
  Banknote,
  Wallet,
  Check,
  X,
  Save,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';

interface Employee {
  id?: string; _id?: string; employeeCode: string; name: string; phone: string;
  designation?: string; department?: string; salary?: any; isActive: boolean;
}
interface AttendanceRow {
  employee: { id: string; code: string; name: string; designation?: string };
  attendance: { status: string } | null;
}
interface AdvanceRow { id: string; employeeId?: any; amount: number; reason?: string; date: string; recoveries: any[]; remainingDue: number; }
interface PayrollRun {
  id: string; period: string; totalNet: number; status: string; lines: any[]; createdAt: string;
}
interface AccountRow { id: string; name: string; accountType: string; currentBalance: number; }

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);
const STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'LATE'] as const;

export default function HRPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const has = (p: string) => isSuper || perms.includes(p);

  const [activeTab, setActiveTab] = useState('employees');
  const [empModal, setEmpModal] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [advModal, setAdvModal] = useState(false);
  const [advForm, setAdvForm] = useState({ employeeId: '', amount: 0, reason: '' });
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [payModal, setPayModal] = useState<PayrollRun | null>(null);
  const [payAccountId, setPayAccountId] = useState('');

  const invalidate = () => {
    ['hr-employees', 'hr-attendance', 'hr-advances', 'hr-payroll'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const { data: employees = [], isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ['hr-employees'],
    queryFn: async () => (await api.get('/hr/employees')).data || [],
    enabled: has('hr:view'),
  });
  const { data: attendanceRows = [], isLoading: attLoading, refetch: refetchAttendance } = useQuery<AttendanceRow[]>({
    queryKey: ['hr-attendance', attendanceDate],
    queryFn: async () => (await api.get(`/hr/attendance?date=${attendanceDate}`)).data || [],
    enabled: has('hr:view'),
  });
  const { data: advances = [], isLoading: advLoading } = useQuery<AdvanceRow[]>({
    queryKey: ['hr-advances'],
    queryFn: async () => (await api.get('/hr/advances')).data || [],
    enabled: has('hr:view'),
  });
  const { data: runs = [], isLoading: runsLoading } = useQuery<PayrollRun[]>({
    queryKey: ['hr-payroll'],
    queryFn: async () => (await api.get('/hr/payroll')).data || [],
    enabled: has('hr:view'),
  });
  const { data: accounts = [] } = useQuery<AccountRow[]>({
    queryKey: ['hr-accounts'],
    queryFn: async () => (await api.get('/accounts')).data || [],
    enabled: !!payModal,
  });

  const createEmployee = useMutation({
    mutationFn: async (payload: any) => { await api.post('/hr/employees', payload); },
    onSuccess: () => { toast.success('Employee added'); setEmpModal(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveAttendance = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(marks)
        .filter(([, status]) => !!status)
        .map(([employeeId, status]) => ({ employeeId, status }));
      if (entries.length === 0) throw new Error('Mark at least one employee');
      await api.post('/hr/attendance', { date: attendanceDate, entries });
    },
    onSuccess: () => { toast.success('Attendance saved'); setMarks({}); refetchAttendance(); },
    onError: (e: any) => toast.error(e.message),
  });
  const createAdvance = useMutation({
    mutationFn: async () => { await api.post('/hr/advances', advForm); },
    onSuccess: () => { toast.success('Advance recorded'); setAdvModal(false); setAdvForm({ employeeId: '', amount: 0, reason: '' }); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const generatePayroll = useMutation({
    mutationFn: async () => { await api.post('/hr/payroll/generate', { period: payrollPeriod }); },
    onSuccess: () => { toast.success(`Payroll draft generated for ${payrollPeriod}`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'cancel' }) => {
      await api.patch(`/hr/payroll/${id}/${action}`);
    },
    onSuccess: (_d, vars) => { toast.success(`Payroll ${vars.action}d`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const payPayroll = useMutation({
    mutationFn: async () => { await api.post(`/hr/payroll/${payModal!.id}/pay`, { accountId: payAccountId }); },
    onSuccess: () => { toast.success('Salary paid — journal posted to the books'); setPayModal(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const canManage = has('hr:manage');
  const canRunPayroll = has('hr:payroll');

  const tabDefs = [
    { key: 'employees', label: 'Employees', count: employees.length },
    { key: 'attendance', label: 'Attendance' },
    { key: 'advances', label: 'Advances', count: advances.length },
    { key: 'payroll', label: 'Payroll' },
  ];

  const EmployeeForm = () => {
    const [form, setForm] = useState({ employeeCode: '', name: '', phone: '', designation: '', department: '', salaryBasic: 0 });
    return (
      <Modal isOpen={empModal} onClose={() => setEmpModal(false)} title="New Employee" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Code (e.g. EMP-001)" value={form.employeeCode} onChange={(e: any) => setForm({ ...form, employeeCode: e.target.value })} />
            <Input placeholder="Full name" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Phone" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Designation" value={form.designation} onChange={(e: any) => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Department" value={form.department} onChange={(e: any) => setForm({ ...form, department: e.target.value })} />
            <Input type="number" placeholder="Basic salary" value={form.salaryBasic} onChange={(e: any) => setForm({ ...form, salaryBasic: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEmpModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createEmployee.isPending}
              disabled={!form.employeeCode || !form.name || !form.phone}
              onClick={() => createEmployee.mutate(form)}
            >
              Add Employee
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg">
            <UsersRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">HR & Payroll</h1>
            <p className="text-sm text-slate-400">Employees, attendance, advances and monthly salary runs</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabDefs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

      {/* Employees */}
      {activeTab === 'employees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">{employees.length} employee(s)</span>
            {canManage && (
              <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => setEmpModal(true)}>New Employee</Button>
            )}
          </div>
          {empLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Designation</th>
                  <th className="px-5 py-3 text-left">Phone</th>
                  <th className="px-5 py-3 text-right">Basic Salary</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {employees.map((e) => (
                  <tr key={e._id || e.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 text-white font-medium">{e.employeeCode}</td>
                    <td className="px-5 py-3.5 text-white">{e.name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{e.designation || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400">{e.phone}</td>
                    <td className="px-5 py-3.5 text-right text-white">{money(e.salary?.basic || 0)}</td>
                    <td className="px-5 py-3.5"><Badge variant={e.isActive ? 'success' : 'danger'} size="sm">{e.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  </tr>
                ))}
                {employees.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No employees yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Attendance */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Date</label>
              <Input type="date" value={attendanceDate} onChange={(e: any) => setAttendanceDate(e.target.value)} />
            </div>
            {has('hr:attendance') && (
              <Button variant="primary" size="sm" leftIcon={<Save />} loading={saveAttendance.isPending} onClick={() => saveAttendance.mutate()}>
                Save Attendance
              </Button>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            {attLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left">Employee</th>
                    <th className="px-5 py-3 text-left">Designation</th>
                    <th className="px-5 py-3 text-left">Recorded</th>
                    <th className="px-5 py-3 text-left">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {attendanceRows.map((row) => (
                    <tr key={row.employee.id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-white">{row.employee.name} <span className="text-[11px] text-slate-500">({row.employee.code})</span></td>
                      <td className="px-5 py-3 text-slate-400">{row.employee.designation || '—'}</td>
                      <td className="px-5 py-3">
                        {row.attendance ? <Badge variant={row.attendance.status === 'PRESENT' ? 'success' : row.attendance.status === 'ABSENT' ? 'danger' : 'warning'} size="sm">{row.attendance.status.replace('_', ' ')}</Badge> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {has('hr:attendance') ? (
                          <select
                            value={marks[row.employee.id] || ''}
                            onChange={(e) => setMarks({ ...marks, [row.employee.id]: e.target.value })}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                          >
                            <option value="">—</option>
                            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                        ) : <span className="text-slate-600 text-xs">read-only</span>}
                      </td>
                    </tr>
                  ))}
                  {attendanceRows.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No active employees.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Advances */}
      {activeTab === 'advances' && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" leftIcon={<Banknote />} onClick={() => setAdvModal(true)}>Give Advance</Button>
            </div>
          )}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            {advLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left">Employee</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Reason</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">Remaining Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {advances.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3.5 text-white">{a.employeeId?.name || '—'} <span className="text-[11px] text-slate-500">({a.employeeId?.employeeCode})</span></td>
                      <td className="px-5 py-3.5 text-slate-400">{new Date(a.date).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-slate-400">{a.reason || '—'}</td>
                      <td className="px-5 py-3.5 text-right text-white">{money(a.amount)}</td>
                      <td className={`px-5 py-3.5 text-right font-medium ${a.remainingDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{money(a.remainingDue)}</td>
                    </tr>
                  ))}
                  {advances.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No advances recorded.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payroll */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {canRunPayroll && (
            <div className="flex flex-wrap items-end gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Salary month</label>
                <Input type="month" value={payrollPeriod} onChange={(e: any) => setPayrollPeriod(e.target.value)} />
              </div>
              <Button variant="primary" size="sm" leftIcon={<FileSpreadsheet />} loading={generatePayroll.isPending} onClick={() => generatePayroll.mutate()}>
                Generate Draft
              </Button>
            </div>
          )}
          <div className="space-y-3">
            {runsLoading && <div className="flex justify-center py-10"><Spinner /></div>}
            {runs.map((run) => (
              <div key={run.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{run.period} Payroll</p>
                    <p className="text-[11px] text-slate-500">{run.lines.length} employee(s) • Total {money(run.totalNet)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={run.status === 'PAID' ? 'success' : run.status === 'DRAFT' ? 'info' : run.status === 'APPROVED' ? 'warning' : 'danger'} size="sm">{run.status}</Badge>
                    {canRunPayroll && run.status === 'DRAFT' && (
                      <>
                        <Button variant="success" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => setStatus.mutate({ id: run.id, action: 'approve' })}>Approve</Button>
                        <Button variant="ghost" size="sm" leftIcon={<X className="w-3.5 h-3.5" />} onClick={() => setStatus.mutate({ id: run.id, action: 'cancel' })}>Cancel</Button>
                      </>
                    )}
                    {canRunPayroll && run.status === 'APPROVED' && (
                      <Button variant="primary" size="sm" leftIcon={<Wallet className="w-3.5 h-3.5" />} onClick={() => { setPayModal(run); setPayAccountId(''); }}>Pay Salaries</Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 uppercase">
                      <tr>
                        <th className="text-left py-1.5">Employee</th>
                        <th className="text-right py-1.5">Paid Days</th>
                        <th className="text-right py-1.5">Basic</th>
                        <th className="text-right py-1.5">Allowances</th>
                        <th className="text-right py-1.5">Adv. Deducted</th>
                        <th className="text-right py-1.5">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {run.lines.map((l: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 text-slate-300">{l.employeeName} <span className="text-slate-600">({l.employeeCode})</span></td>
                          <td className="py-1.5 text-right text-slate-400">{l.presentDays}</td>
                          <td className="py-1.5 text-right text-slate-400">{money(l.basic)}</td>
                          <td className="py-1.5 text-right text-slate-400">{money(l.allowances)}</td>
                          <td className="py-1.5 text-right text-amber-400">{l.advanceDeducted ? `−${money(l.advanceDeducted)}` : '—'}</td>
                          <td className="py-1.5 text-right text-white font-semibold">{money(l.netPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {!runsLoading && runs.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm">
                No payroll runs yet — generate a draft for a month.
              </div>
            )}
          </div>
        </div>
      )}

      <EmployeeForm />

      {/* Advance modal */}
      <Modal isOpen={advModal} onClose={() => setAdvModal(false)} title="Give Advance" size="sm">
        <div className="space-y-3">
          <select value={advForm.employeeId} onChange={(e: any) => setAdvForm({ ...advForm, employeeId: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">Select employee</option>
            {employees.filter((e) => e.isActive).map((e) => (
              <option key={e._id || e.id} value={e._id || e.id}>{e.name} ({e.employeeCode})</option>
            ))}
          </select>
          <Input type="number" placeholder="Amount" value={advForm.amount} onChange={(e: any) => setAdvForm({ ...advForm, amount: Number(e.target.value) })} />
          <Input placeholder="Reason (optional)" value={advForm.reason} onChange={(e: any) => setAdvForm({ ...advForm, reason: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAdvModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createAdvance.isPending} disabled={!advForm.employeeId || advForm.amount <= 0} onClick={() => createAdvance.mutate()}>Record Advance</Button>
          </div>
        </div>
      </Modal>

      {/* Pay modal */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title={`Pay Salaries — ${payModal?.period || ''}`} subtitle={`Total ${money(payModal?.totalNet || 0)}`} size="sm">
        <div className="space-y-3">
          <select value={payAccountId} onChange={(e: any) => setPayAccountId(e.target.value)} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">Pay from wallet</option>
            {accounts.filter((a) => a.accountType !== 'OTHER').map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {money(a.currentBalance)}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">A balanced journal (Dr Salary &amp; Allowances / Cr wallet) is posted automatically.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPayModal(null)}>Cancel</Button>
            <Button variant="primary" loading={payPayroll.isPending} disabled={!payAccountId} onClick={() => payPayroll.mutate()}>Pay & Post</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
