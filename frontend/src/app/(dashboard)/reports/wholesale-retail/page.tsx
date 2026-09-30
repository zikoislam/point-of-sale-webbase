'use client';

import React, { useState } from 'react';
import { PieChart as PieIcon, Store, Truck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { Badge } from '../../../../components/ui/Badge';

/**
 * Wholesale vs Retail — how the two channels compare.
 *
 * The API already split sales by `pricingTier`; this page is the dedicated
 * view for it (it used to be buried as a tab inside Sales Insights).
 */
interface ChannelRow {
  channel: string;
  invoices: number;
  revenue: number;
  discount: number;
  dues: number;
  items: number;
  averageBill: number;
  averageItems: number;
  revenueShare: number;
}

interface WholesaleVsRetailReport {
  summary: {
    totalRevenue: number;
    totalInvoices: number;
    retail: ChannelRow | null;
    wholesale: ChannelRow | null;
  };
  data: ChannelRow[];
}

const COLORS: Record<string, string> = {
  RETAIL: '#6366f1',
  WHOLESALE: '#10b981',
  DISTRIBUTOR: '#f59e0b',
  ONLINE: '#06b6d4',
};

export default function WholesaleRetailPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, loading, error, reload } = useReportData<WholesaleVsRetailReport>(
    '/reports/wholesale-vs-retail',
    startDate,
    endDate
  );

  const rows = data?.data || [];
  const summary = data?.summary;
  const retail = summary?.retail || null;
  const wholesale = summary?.wholesale || null;
  const totalRevenue = summary?.totalRevenue ?? 0;

  const chartData = rows.map((r) => ({ name: r.channel, value: r.revenue }));
  const ratio = (part?: number) => (totalRevenue > 0 ? ((part ?? 0) / totalRevenue) * 100 : 0);

  return (
    <ReportShell
      title="Wholesale vs Retail"
      subtitle="Channel split — invoice count, revenue share, average bill and outstanding dues"
      icon={PieIcon}
      exportType="wholesale-vs-retail"
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
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Revenue"
            value={money(totalRevenue)}
            tone="emerald"
            hint={`${summary?.totalInvoices ?? 0} invoices`}
          />
          <KpiCard
            label="Retail Revenue"
            value={money(retail?.revenue ?? 0)}
            tone="indigo"
            hint={`${ratio(retail?.revenue).toFixed(1)}% of revenue`}
          />
          <KpiCard
            label="Wholesale Revenue"
            value={money(wholesale?.revenue ?? 0)}
            tone="amber"
            hint={`${ratio(wholesale?.revenue).toFixed(1)}% of revenue`}
          />
          <KpiCard
            label="Average Bill"
            value={money(retail?.averageBill ?? 0)}
            tone="white"
            hint={`Wholesale ${money(wholesale?.averageBill ?? 0)}`}
          />
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <Store className="w-4 h-4 text-indigo-400" /> Retail
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Invoices</dt>
                <dd className="text-white font-bold text-base">{retail?.invoices ?? 0}</dd>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Revenue</dt>
                <dd className="text-white font-bold text-base">{money(retail?.revenue ?? 0)}</dd>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Avg bill</dt>
                <dd className="text-white font-bold text-base">{money(retail?.averageBill ?? 0)}</dd>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Discount given</dt>
                <dd className="text-amber-300 font-bold text-base">{money(retail?.discount ?? 0)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <Truck className="w-4 h-4 text-emerald-400" /> Wholesale
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Invoices</dt>
                <dd className="text-white font-bold text-base">{wholesale?.invoices ?? 0}</dd>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Revenue</dt>
                <dd className="text-white font-bold text-base">{money(wholesale?.revenue ?? 0)}</dd>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Avg bill</dt>
                <dd className="text-white font-bold text-base">{money(wholesale?.averageBill ?? 0)}</dd>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3">
                <dt className="text-slate-500 uppercase text-[10px]">Outstanding dues</dt>
                <dd className="text-rose-300 font-bold text-base">{money(wholesale?.dues ?? 0)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Revenue split donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-white mb-3">Revenue share by channel</h3>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-slate-500 text-sm">No sales in this period.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                    formatter={(value: any) => money(Number(value))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detail table */}
        <ReportTable
          headers={[
            { label: 'Channel' },
            { label: 'Invoices', align: 'right' },
            { label: 'Items', align: 'right' },
            { label: 'Revenue', align: 'right' },
            { label: 'Avg Bill', align: 'right' },
            { label: 'Discount', align: 'right' },
            { label: 'Dues', align: 'right' },
            { label: 'Share %', align: 'right' },
          ]}
          isEmpty={rows.length === 0}
          empty="No sales recorded in this period."
        >
          {rows.map((r) => (
            <tr key={r.channel} className="hover:bg-slate-800/40">
              <td className="py-3 px-4">
                <span className="font-semibold text-white">{r.channel}</span>
              </td>
              <td className="py-3 px-4 text-right text-slate-300">{r.invoices}</td>
              <td className="py-3 px-4 text-right text-slate-400">{r.items}</td>
              <td className="py-3 px-4 text-right font-bold text-white">{money(r.revenue)}</td>
              <td className="py-3 px-4 text-right text-slate-300">{money(r.averageBill)}</td>
              <td className="py-3 px-4 text-right text-amber-300">{money(r.discount)}</td>
              <td className={`py-3 px-4 text-right ${r.dues > 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                {money(r.dues)}
              </td>
              <td className="py-3 px-4 text-right">
                <Badge variant={r.channel === 'WHOLESALE' ? 'success' : 'info'} size="sm">
                  {r.revenueShare}%
                </Badge>
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
