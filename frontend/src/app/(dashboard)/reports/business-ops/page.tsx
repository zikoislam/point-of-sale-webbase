'use client';

import React, { useMemo, useState } from 'react';
import { BarChart3, Globe, Truck, Target, LifeBuoy, CalendarOff } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

type OpsTab = 'online-offline' | 'fulfilment' | 'leads' | 'tickets' | 'leave';

const TABS: { key: OpsTab; label: string; icon: React.ReactNode }[] = [
  { key: 'online-offline', label: 'Online vs Offline', icon: <Globe className="w-3.5 h-3.5" /> },
  { key: 'fulfilment', label: 'eCommerce Fulfilment', icon: <Truck className="w-3.5 h-3.5" /> },
  { key: 'leads', label: 'Lead Conversion', icon: <Target className="w-3.5 h-3.5" /> },
  { key: 'tickets', label: 'Ticket SLA', icon: <LifeBuoy className="w-3.5 h-3.5" /> },
  { key: 'leave', label: 'Leave Summary', icon: <CalendarOff className="w-3.5 h-3.5" /> },
];

const PIE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

export default function BusinessOpsReportsPage() {
  const [tab, setTab] = useState<OpsTab>('online-offline');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const endpoint = useMemo(() => {
    switch (tab) {
      case 'online-offline':
        return '/reports/online-vs-offline';
      case 'fulfilment':
        return '/reports/fulfillment-rate';
      case 'leads':
        return '/reports/lead-conversion';
      case 'tickets':
        return '/reports/ticket-sla';
      default:
        return '/reports/leave-summary';
    }
  }, [tab]);

  const { data, loading, error, reload } = useReportData<any>(endpoint, startDate, endDate, true);

  return (
    <div className="space-y-6">
      <ReportShell
        title="Business Operations"
        subtitle="Online vs counter sales, delivery performance, lead conversion, service SLA and leave"
        icon={BarChart3}
        exportType={tab}
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onRefresh={reload}
        loading={loading}
        error={error}
      >
        {tab === 'online-offline' && <OnlineOffline data={data} />}
        {tab === 'fulfilment' && <Fulfilment data={data} />}
        {tab === 'leads' && <Leads data={data} />}
        {tab === 'tickets' && <Tickets data={data} />}
        {tab === 'leave' && <Leave data={data} />}
      </ReportShell>

      <div className="-mt-2">
        <Tabs
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          activeTab={tab}
          onChange={(k) => setTab(k as OpsTab)}
          variant="pills"
        />
      </div>
    </div>
  );
}

function OnlineOffline({ data }: { data: any }) {
  if (!data) return null;
  const chart = (data.data || []).map((r: any) => ({ month: r.month, POS: r.posRevenue, Online: r.onlineRevenue }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Counter Revenue" value={money(data.summary?.posRevenue)} tone="indigo" hint={`${data.summary?.posOrders ?? 0} orders`} />
        <KpiCard label="Online Revenue" value={money(data.summary?.onlineRevenue)} tone="emerald" hint={`${data.summary?.onlineOrders ?? 0} orders`} />
        <KpiCard label="Online Share" value={`${data.summary?.onlineSharePercent ?? 0}%`} tone="purple" />
        <KpiCard label="Best Online Month" value={data.summary?.bestOnlineMonth?.month || '—'} tone="white" hint={data.summary?.bestOnlineMonth ? money(data.summary.bestOnlineMonth.onlineRevenue) : undefined} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Channel revenue by month</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="POS" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Online" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ReportTable
        headers={[
          { label: 'Month' },
          { label: 'POS Orders', align: 'right' },
          { label: 'POS Revenue', align: 'right' },
          { label: 'POS Avg', align: 'right' },
          { label: 'Online Orders', align: 'right' },
          { label: 'Online Revenue', align: 'right' },
          { label: 'Online Avg', align: 'right' },
          { label: 'Online %', align: 'right' },
        ]}
        isEmpty={!(data.data || []).length}
      >
        {(data.data || []).map((r: any) => (
          <tr key={r.month} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-white font-medium">{r.month}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.posOrders}</td>
            <td className="py-2.5 px-4 text-right text-indigo-400">{money(r.posRevenue)}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{money(r.posAverageOrder)}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.onlineOrders}</td>
            <td className="py-2.5 px-4 text-right text-emerald-400">{money(r.onlineRevenue)}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{money(r.onlineAverageOrder)}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.onlineSharePercent}%</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function Fulfilment({ data }: { data: any }) {
  if (!data) return null;
  const pie = (data.byStatus || []).map((s: any) => ({ name: s.status, value: s.orders }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Orders" value={String(data.summary?.orders ?? 0)} tone="indigo" />
        <KpiCard label="Fulfilment Rate" value={data.summary?.fulfillmentRatePercent === null ? '—' : `${data.summary?.fulfillmentRatePercent}%`} tone="emerald" />
        <KpiCard label="Cancelled" value={`${data.summary?.cancellationRatePercent ?? 0}%`} tone="rose" />
        <KpiCard label="Avg Delivery" value={data.summary?.averageDeliveryDays === null ? '—' : `${data.summary?.averageDeliveryDays} days`} tone="amber" />
        <KpiCard label="COD Pending" value={money(data.summary?.codPending)} tone="white" hint={`Online revenue ${money(data.summary?.onlineRevenue)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Orders by status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pie.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE[i % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ReportTable
          headers={[
            { label: 'Courier' },
            { label: 'Shipments', align: 'right' },
            { label: 'Delivered', align: 'right' },
            { label: 'Success %', align: 'right' },
          ]}
          isEmpty={!(data.byCourier || []).length}
          empty="No courier activity in this period."
        >
          {(data.byCourier || []).map((c: any) => (
            <tr key={c.provider} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white font-medium">{c.provider}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{c.orders}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400">{c.delivered}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{c.successRatePercent}%</td>
            </tr>
          ))}
        </ReportTable>
      </div>

      <ReportTable
        headers={[
          { label: 'Order' },
          { label: 'Date', align: 'center' },
          { label: 'Amount', align: 'right' },
          { label: 'Payment', align: 'center' },
          { label: 'Fulfilment', align: 'center' },
          { label: 'Courier' },
          { label: 'Courier Status' },
          { label: 'Days', align: 'right' },
        ]}
        isEmpty={!(data.data || []).length}
      >
        {(data.data || []).map((r: any) => (
          <tr key={r.id} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 font-mono text-[11px] text-white">{r.orderNo}</td>
            <td className="py-2.5 px-4 text-center text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.totalAmount)}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={r.paymentStatus === 'PAID' ? 'success' : 'warning'}>{r.paymentStatus}</Badge>
            </td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={r.fulfillmentStatus === 'DELIVERED' ? 'success' : r.fulfillmentStatus === 'CANCELLED' ? 'danger' : 'info'}>
                {r.fulfillmentStatus}
              </Badge>
            </td>
            <td className="py-2.5 px-4 text-slate-400">{r.courier}</td>
            <td className="py-2.5 px-4 text-slate-400">{r.courierStatus}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{r.daysToDeliver ?? '—'}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function Leads({ data }: { data: any }) {
  if (!data) return null;
  const funnel = (data.byStage || []).map((s: any) => ({ stage: s.stage, leads: s.leads }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Leads" value={String(data.summary?.totalLeads ?? 0)} tone="indigo" />
        <KpiCard label="Conversion Rate" value={data.summary?.conversionRatePercent === null ? '—' : `${data.summary?.conversionRatePercent}%`} tone="emerald" hint={`${data.summary?.won ?? 0} won · ${data.summary?.lost ?? 0} lost`} />
        <KpiCard label="Open Pipeline" value={money(data.summary?.openPipelineValue)} tone="white" />
        <KpiCard label="Won Value" value={money(data.summary?.wonValue)} tone="emerald" />
        <KpiCard label="Avg Days To Convert" value={data.summary?.averageDaysToConvert === null ? '—' : String(data.summary?.averageDaysToConvert)} tone="amber" hint={`${data.summary?.overdueFollowUps ?? 0} follow-up(s) overdue`} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Pipeline funnel</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="stage" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ReportTable
          headers={[
            { label: 'Source' },
            { label: 'Leads', align: 'right' },
            { label: 'Won', align: 'right' },
            { label: 'Conversion %', align: 'right' },
            { label: 'Won Value', align: 'right' },
          ]}
          isEmpty={!(data.bySource || []).length}
        >
          {(data.bySource || []).map((s: any) => (
            <tr key={s.source} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white">{s.source.replace(/_/g, ' ')}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{s.leads}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400">{s.won}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{s.conversionRatePercent}%</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{money(s.wonValue)}</td>
            </tr>
          ))}
        </ReportTable>

        <ReportTable
          headers={[
            { label: 'Owner' },
            { label: 'Leads', align: 'right' },
            { label: 'Won', align: 'right' },
            { label: 'Pipeline Value', align: 'right' },
          ]}
          isEmpty={!(data.byOwner || []).length}
        >
          {(data.byOwner || []).map((o: any) => (
            <tr key={o.owner} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white">{o.owner}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{o.leads}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400">{o.won}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{money(o.value)}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  );
}

function Tickets({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Tickets" value={String(data.summary?.tickets ?? 0)} tone="indigo" />
        <KpiCard label="SLA Compliance" value={data.summary?.slaCompliancePercent === null ? '—' : `${data.summary?.slaCompliancePercent}%`} tone="emerald" />
        <KpiCard label="Currently Overdue" value={String(data.summary?.currentlyOverdue ?? 0)} tone="rose" />
        <KpiCard label="Avg First Response" value={data.summary?.averageResponseHours === null ? '—' : `${data.summary?.averageResponseHours}h`} tone="white" />
        <KpiCard label="Avg Resolution" value={data.summary?.averageResolutionHours === null ? '—' : `${data.summary?.averageResolutionHours}h`} tone="amber" hint={data.summary?.averageRating ? `Rating ${data.summary.averageRating}/5` : undefined} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ReportTable
          headers={[
            { label: 'Priority' },
            { label: 'Tickets', align: 'right' },
            { label: 'Breached', align: 'right' },
            { label: 'Compliance %', align: 'right' },
          ]}
          isEmpty={!(data.byPriority || []).length}
        >
          {(data.byPriority || []).map((p: any) => (
            <tr key={p.priority} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white font-medium">{p.priority}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{p.tickets}</td>
              <td className="py-2.5 px-4 text-right text-rose-400">{p.breached}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{p.compliancePercent === null ? '—' : `${p.compliancePercent}%`}</td>
            </tr>
          ))}
        </ReportTable>

        <ReportTable
          headers={[
            { label: 'Agent' },
            { label: 'Assigned', align: 'right' },
            { label: 'Resolved', align: 'right' },
            { label: 'Breached', align: 'right' },
          ]}
          isEmpty={!(data.byAgent || []).length}
        >
          {(data.byAgent || []).map((a: any) => (
            <tr key={a.agent} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white">{a.agent}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{a.assigned}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400">{a.resolved}</td>
              <td className="py-2.5 px-4 text-right text-rose-400">{a.breached}</td>
            </tr>
          ))}
        </ReportTable>
      </div>

      <ReportTable
        headers={[
          { label: 'Ticket' },
          { label: 'Subject' },
          { label: 'Priority', align: 'center' },
          { label: 'Status', align: 'center' },
          { label: 'Response', align: 'right' },
          { label: 'Resolved', align: 'right' },
          { label: 'SLA', align: 'center' },
        ]}
        isEmpty={!(data.data || []).length}
      >
        {(data.data || []).map((t: any) => (
          <tr key={t.id} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 font-mono text-[11px] text-white">{t.ticketNo}</td>
            <td className="py-2.5 px-4 text-slate-300 max-w-[280px] truncate">{t.subject}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={t.priority === 'URGENT' ? 'danger' : t.priority === 'HIGH' ? 'warning' : 'neutral'}>{t.priority}</Badge>
            </td>
            <td className="py-2.5 px-4 text-center text-slate-400">{t.status.replace('_', ' ')}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{t.responseHours === null ? '—' : `${t.responseHours}h`}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{t.resolutionHours === null ? '—' : `${t.resolutionHours}h`}</td>
            <td className="py-2.5 px-4 text-center">
              {t.slaMet === null ? (
                <Badge variant={t.isBreached ? 'danger' : 'warning'}>{t.isBreached ? 'overdue' : 'waiting'}</Badge>
              ) : (
                <Badge variant={t.slaMet ? 'success' : 'danger'}>{t.slaMet ? 'met' : 'breached'}</Badge>
              )}
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function Leave({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Employees On Leave" value={String(data.summary?.employees ?? 0)} tone="indigo" />
        <KpiCard label="Total Leave Days" value={String(data.summary?.totalDays ?? 0)} tone="white" />
        <KpiCard label="Avg Days / Employee" value={String(data.summary?.averageDaysPerEmployee ?? 0)} tone="amber" />
        <KpiCard
          label="Most Common Type"
          value={Object.entries(data.summary?.byType || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '—'}
          tone="emerald"
        />
      </div>

      <ReportTable
        headers={[
          { label: 'Employee' },
          { label: 'Code' },
          { label: 'Department' },
          { label: 'Leave Days', align: 'right' },
          { label: 'Requests', align: 'right' },
          { label: 'Breakdown' },
        ]}
        isEmpty={!(data.data || []).length}
        empty="No approved leave in this period."
      >
        {(data.data || []).map((r: any) => (
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
  );
}
