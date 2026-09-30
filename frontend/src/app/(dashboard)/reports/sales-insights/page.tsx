'use client';

import React, { useMemo, useState } from 'react';
import { Receipt, Store, Trophy } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

type InsightTab = 'register' | 'channels' | 'top';

const TABS: { key: InsightTab; label: string; icon: React.ReactNode; exportType: string }[] = [
  { key: 'register', label: 'Daily Register', icon: <Receipt className="w-3.5 h-3.5" />, exportType: 'daily-register' },
  { key: 'channels', label: 'Wholesale vs Retail', icon: <Store className="w-3.5 h-3.5" />, exportType: 'wholesale-vs-retail' },
  { key: 'top', label: 'Top Selling Products', icon: <Trophy className="w-3.5 h-3.5" />, exportType: 'top-products' },
];

const CHANNEL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

export default function SalesInsightsPage() {
  const [activeTab, setActiveTab] = useState<InsightTab>('register');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const meta = TABS.find((t) => t.key === activeTab)!;
  const endpoint = useMemo(() => {
    if (activeTab === 'register') return '/reports/daily-register';
    if (activeTab === 'channels') return '/reports/wholesale-vs-retail';
    return '/reports/top-products?limit=50';
  }, [activeTab]);

  const { data, loading, error, reload } = useReportData<any>(endpoint, startDate, endDate, true);

  // The register and top-product tabs accept a limit/date; channels too
  const chartData = useMemo(() => {
    if (activeTab !== 'register') return [];
    return (data?.data || []).slice(0, 30).reverse();
  }, [activeTab, data]);

  return (
    <div className="space-y-6">
      <ReportShell
        title="Sales Insights"
        subtitle="Daily register, retail vs wholesale mix and your best sellers"
        icon={Receipt}
        exportType={meta.exportType}
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
        {activeTab === 'register' && <RegisterTab data={data} chartData={chartData} />}
        {activeTab === 'channels' && <ChannelsTab data={data} />}
        {activeTab === 'top' && <TopProductsTab data={data} />}
      </ReportShell>

      <div className="-mt-2">
        <Tabs
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as InsightTab)}
          variant="pills"
        />
      </div>
    </div>
  );
}

function RegisterTab({ data, chartData }: { data: any; chartData: any[] }) {
  if (!data) return null;
  const best = data.summary?.bestDay;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Net Sales" value={money(data.summary?.net)} tone="emerald" />
        <KpiCard label="Invoices" value={String(data.summary?.invoices ?? 0)} tone="indigo" />
        <KpiCard label="Discount" value={money(data.summary?.discount)} tone="amber" />
        <KpiCard label="Credit Given" value={money(data.summary?.dues)} tone="rose" />
        <KpiCard
          label="Best Day"
          value={best ? money(best.net) : '—'}
          tone="white"
          hint={best?.date ? `${best.date} · ${best.invoices} invoice(s)` : undefined}
        />
      </div>

      {chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Net sales by day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => money(Number(v))}
                />
                <Area type="monotone" dataKey="net" name="Net sales" stroke="#10b981" fill="url(#netFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <ReportTable
        headers={[
          { label: 'Date' },
          { label: 'Invoices', align: 'right' },
          { label: 'Gross', align: 'right' },
          { label: 'Discount', align: 'right' },
          { label: 'Tax', align: 'right' },
          { label: 'Net', align: 'right' },
          { label: 'Cash', align: 'right' },
          { label: 'Card', align: 'right' },
          { label: 'MFS', align: 'right' },
          { label: 'Due', align: 'right' },
          { label: 'Avg Bill', align: 'right' },
        ]}
        isEmpty={!data.data?.length}
      >
        {data.data?.map((r: any) => (
          <tr key={r.date} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-white font-medium">{r.date}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.invoices}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.gross)}</td>
            <td className="py-2.5 px-4 text-right text-amber-400">{money(r.discount)}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{money(r.tax)}</td>
            <td className="py-2.5 px-4 text-right text-emerald-400 font-semibold">{money(r.net)}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.cash)}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.card)}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.mfs)}</td>
            <td className="py-2.5 px-4 text-right text-rose-400">{money(r.dues)}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{money(r.averageBill)}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function ChannelsTab({ data }: { data: any }) {
  if (!data) return null;
  const pie = (data.data || []).map((r: any) => ({ name: r.channel, value: r.revenue }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Revenue" value={money(data.summary?.totalRevenue)} tone="emerald" />
        <KpiCard
          label="Retail"
          value={money(data.summary?.retail?.revenue)}
          tone="indigo"
          hint={data.summary?.retail ? `${data.summary.retail.invoices} invoice(s) · avg ${money(data.summary.retail.averageBill)}` : 'No retail sales'}
        />
        <KpiCard
          label="Wholesale"
          value={money(data.summary?.wholesale?.revenue)}
          tone="purple"
          hint={data.summary?.wholesale ? `${data.summary.wholesale.invoices} invoice(s) · avg ${money(data.summary.wholesale.averageBill)}` : 'No wholesale sales'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Revenue share</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pie.map((_: any, i: number) => (
                    <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => money(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ReportTable
          headers={[
            { label: 'Channel' },
            { label: 'Invoices', align: 'right' },
            { label: 'Items', align: 'right' },
            { label: 'Revenue', align: 'right' },
            { label: 'Avg Bill', align: 'right' },
            { label: 'Share', align: 'right' },
          ]}
          isEmpty={!data.data?.length}
        >
          {data.data?.map((r: any) => (
            <tr key={r.channel} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4">
                <Badge variant={r.channel === 'WHOLESALE' ? 'purple' : 'info'}>{r.channel}</Badge>
              </td>
              <td className="py-2.5 px-4 text-right text-slate-300">{r.invoices}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{r.items}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400 font-semibold">{money(r.revenue)}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{money(r.averageBill)}</td>
              <td className="py-2.5 px-4 text-right text-slate-400">{r.revenueShare}%</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  );
}

function TopProductsTab({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Products Sold" value={String(data.summary?.products ?? 0)} tone="indigo" />
        <KpiCard label="Total Quantity" value={String(data.summary?.totalQuantity ?? 0)} tone="white" />
        <KpiCard label="Revenue" value={money(data.summary?.totalRevenue)} tone="emerald" />
      </div>
      <ReportTable
        headers={[
          { label: '#' , align: 'center' },
          { label: 'Product' },
          { label: 'SKU' },
          { label: 'Qty', align: 'right' },
          { label: 'Revenue', align: 'right' },
          { label: 'Orders', align: 'right' },
          { label: 'Share', align: 'right' },
        ]}
        isEmpty={!data.data?.length}
      >
        {data.data?.map((r: any) => (
          <tr key={r.variantId} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-center">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                  r.rank === 1
                    ? 'bg-amber-500/20 text-amber-300'
                    : r.rank <= 3
                    ? 'bg-slate-700 text-slate-200'
                    : 'text-slate-500'
                }`}
              >
                {r.rank}
              </span>
            </td>
            <td className="py-2.5 px-4 text-white font-medium">{r.productName}</td>
            <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{r.sku}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.quantity}</td>
            <td className="py-2.5 px-4 text-right text-emerald-400 font-semibold">{money(r.revenue)}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{r.orders}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{r.revenueShare}%</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}
