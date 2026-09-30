'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Layers,
  Tags,
  Boxes,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ReportShell, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { DataTable, Column } from '../../../../components/ui/DataTable';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

type Dimension = 'category' | 'brand' | 'group';

interface DimensionRow {
  id: string | null;
  name: string;
  totalQty: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  productCount: number;
}

interface DimensionReport {
  summary: {
    totalRevenue: number;
    totalProfit: number;
    topCategory?: string | null;
    topBrand?: string | null;
    topGroup?: string | null;
  };
  data: DimensionRow[];
}

const ENDPOINTS: Record<Dimension, string> = {
  category: '/reports/category-wise-sales',
  brand: '/reports/brand-wise-sales',
  group: '/reports/group-wise-sales',
};

const LABELS: Record<Dimension, string> = {
  category: 'Category',
  brand: 'Brand',
  group: 'Product Group',
};

export default function CategoryAnalysisPage() {
  const [activeTab, setActiveTab] = useState<Dimension>('category');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, loading, error, reload } = useReportData<DimensionReport>(
    ENDPOINTS[activeTab],
    startDate,
    endDate
  );

  const rows = data?.data || [];
  const label = LABELS[activeTab];

  const totalRevenue = data?.summary.totalRevenue ?? 0;
  const totalProfit = data?.summary.totalProfit ?? 0;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const topPerformer =
    data?.summary.topCategory ?? data?.summary.topBrand ?? data?.summary.topGroup ?? '—';

  // Chart shows the top 10 performers so the axis stays readable
  const chartRows = rows.slice(0, 10).map((r) => ({
    name: r.name.length > 14 ? `${r.name.slice(0, 14)}…` : r.name,
    revenue: r.totalRevenue,
    profit: r.grossProfit,
  }));

  const columns: Column<DimensionRow>[] = [
    {
      key: 'name',
      header: LABELS[activeTab],
      sortable: true,
      render: (row) => <span className="font-semibold text-white">{row.name}</span>,
    },
    {
      key: 'totalQty',
      header: 'Total Qty',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-slate-300">{row.totalQty}</span>,
    },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      sortable: true,
      align: 'right',
      render: (row) => <span className="font-bold text-white">{money(row.totalRevenue)}</span>,
    },
    {
      key: 'totalCost',
      header: 'Total Cost',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-slate-400">{money(row.totalCost)}</span>,
    },
    {
      key: 'grossProfit',
      header: 'Gross Profit',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className={`font-black ${row.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {money(row.grossProfit)}
        </span>
      ),
    },
    {
      key: 'profitMarginPercent',
      header: 'Margin %',
      sortable: true,
      align: 'right',
      render: (row) => (
        <Badge
          variant={row.profitMarginPercent >= 20 ? 'success' : row.profitMarginPercent > 0 ? 'warning' : 'danger'}
          size="sm"
        >
          {row.profitMarginPercent}%
        </Badge>
      ),
    },
    {
      key: 'productCount',
      header: 'Products',
      sortable: true,
      align: 'center',
      render: (row) => <span className="text-slate-400">{row.productCount}</span>,
    },
  ];

  return (
    <ReportShell
      title="Category / Brand / Group Analysis"
      subtitle="Where the revenue and the profit actually come from — by category, brand and product group"
      icon={BarChart3}
      exportType={`${activeTab}-wise-sales`}
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
        {/* Dimension tabs */}
        <Tabs
          tabs={[
            { key: 'category', label: 'Category Wise', icon: <Layers className="w-3.5 h-3.5" /> },
            { key: 'brand', label: 'Brand Wise', icon: <Tags className="w-3.5 h-3.5" /> },
            { key: 'group', label: 'Group Wise', icon: <Boxes className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as Dimension)}
          variant="pills"
        />

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Revenue" value={money(totalRevenue)} tone="emerald" hint="All sales in the period" />
          <KpiCard label="Total Gross Profit" value={money(totalProfit)} tone="indigo" hint="Revenue − cost of goods" />
          <KpiCard label={`Top ${label}`} value={String(topPerformer)} tone="amber" hint="Highest revenue" />
          <KpiCard label="Avg Margin %" value={`${avgMargin.toFixed(1)}%`} tone="white" hint="Profit ÷ revenue" />
        </div>

        {/* Revenue vs profit chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Revenue vs Gross Profit — top {chartRows.length}</h3>
            <span className="text-[11px] text-slate-500">by {label.toLowerCase()}</span>
          </div>
          {chartRows.length === 0 ? (
            <p className="py-12 text-center text-slate-500 text-sm">No sales in this period.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    stroke="#334155"
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: any, name: any) => [money(Number(value)), name === 'revenue' ? 'Revenue' : 'Gross Profit']}
                  />
                  <Bar dataKey="revenue" name="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name="profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sortable detail table */}
        <DataTable<DimensionRow>
          columns={columns}
          data={rows}
          keyExtractor={(row) => `${row.name}-${row.id || ''}`}
          loading={false}
          emptyMessage="No sales recorded in this period."
        />

        {/* Totals strip */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-5 py-3.5">
            <span className="text-xs uppercase tracking-wide text-slate-400 font-bold">
              {rows.length} {label.toLowerCase()}(s) in this period
            </span>
            <div className="flex items-center gap-5 text-sm">
              <span className="text-slate-400">
                Revenue <strong className="text-white">{money(totalRevenue)}</strong>
              </span>
              <span className="text-slate-400">
                Profit <strong className="text-emerald-400">{money(totalProfit)}</strong>
              </span>
              <span className="text-slate-400">
                Margin <strong className="text-amber-300">{avgMargin.toFixed(1)}%</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </ReportShell>
  );
}
