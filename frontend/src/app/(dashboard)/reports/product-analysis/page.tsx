'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Package, Filter, RotateCcw } from 'lucide-react';
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
import { Badge } from '../../../../components/ui/Badge';
import { api } from '../../../../lib/api-client';

type GroupBy = 'product' | 'variant' | 'barcode' | 'category' | 'brand' | 'group';

interface AnalysisRow {
  id: string | null;
  name: string;
  totalQty: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  productCount: number;
}

interface AnalysisReport {
  groupBy: GroupBy;
  summary: {
    totalRevenue: number;
    totalProfit: number;
    totalQty: number;
    top: string | null;
    rows: number;
  };
  data: AnalysisRow[];
}

interface Option {
  value: string;
  label: string;
}

const GROUP_BY: { value: GroupBy; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'variant', label: 'Variant' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'group', label: 'Product Group' },
];

const GROUP_LABEL: Record<GroupBy, string> = {
  product: 'Product',
  variant: 'Variant',
  barcode: 'Barcode',
  category: 'Category',
  brand: 'Brand',
  group: 'Product Group',
};

const FIELD_CLASS =
  'px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 min-w-[150px]';

export default function ProductAnalysisPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>('product');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown filters
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [color, setColor] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [tag, setTag] = useState('');
  const [barcode, setBarcode] = useState('');

  // Dropdown option sources
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    const extract = (res: any): any[] => {
      const d = res?.data;
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.data)) return d.data;
      return [];
    };

    Promise.all([
      api.get('/categories').catch(() => ({ data: [] } as any)),
      api.get('/brands').catch(() => ({ data: [] } as any)),
      api.get('/product-groups').catch(() => ({ data: [] } as any)),
      api.get('/products/filter-options').catch(() => ({ data: {} } as any)),
    ]).then(([catRes, brandRes, groupRes, filterRes]) => {
      setCategories(extract(catRes).map((c: any) => ({ value: c.id || c._id, label: c.name })));
      setBrands(extract(brandRes).map((b: any) => ({ value: b.id || b._id, label: b.name })));
      setGroups(extract(groupRes).map((g: any) => ({ value: g.id || g._id, label: g.name })));

      const f = filterRes?.data?.data || filterRes?.data || {};
      setColors(f.colors || []);
      setModels(f.models || []);
      setTags(f.tags || []);
    });
  }, []);

  // The whole query is baked into the endpoint so the shared hook just fetches it.
  const endpoint = useMemo(() => {
    const p = new URLSearchParams({ groupBy });
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    if (categoryId) p.set('categoryId', categoryId);
    if (subCategoryId) p.set('subCategoryId', subCategoryId);
    if (brandId) p.set('brandId', brandId);
    if (groupId) p.set('groupId', groupId);
    if (color) p.set('color', color);
    if (modelNo) p.set('modelNo', modelNo);
    if (tag) p.set('tag', tag);
    if (barcode.trim()) p.set('barcode', barcode.trim());
    return `/reports/product-analysis?${p.toString()}`;
  }, [groupBy, startDate, endDate, categoryId, subCategoryId, brandId, groupId, color, modelNo, tag, barcode]);

  const { data, loading, error, reload } = useReportData<AnalysisReport>(endpoint, undefined, undefined, false);

  // Filters repeated on the export URLs (dates are added by ReportShell).
  const extraQuery = useMemo(() => {
    const e: Record<string, string> = { groupBy };
    if (categoryId) e.categoryId = categoryId;
    if (subCategoryId) e.subCategoryId = subCategoryId;
    if (brandId) e.brandId = brandId;
    if (groupId) e.groupId = groupId;
    if (color) e.color = color;
    if (modelNo) e.modelNo = modelNo;
    if (tag) e.tag = tag;
    if (barcode.trim()) e.barcode = barcode.trim();
    return e;
  }, [groupBy, categoryId, subCategoryId, brandId, groupId, color, modelNo, tag, barcode]);

  const rows = data?.data || [];
  const groupLabel = GROUP_LABEL[groupBy];

  const totalRevenue = data?.summary.totalRevenue ?? 0;
  const totalProfit = data?.summary.totalProfit ?? 0;
  const totalQty = data?.summary.totalQty ?? 0;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const chartRows = rows.slice(0, 10).map((r) => ({
    name: r.name && r.name.length > 16 ? `${r.name.slice(0, 16)}…` : r.name,
    revenue: r.totalRevenue,
    profit: r.grossProfit,
  }));

  const reset = () => {
    setCategoryId('');
    setSubCategoryId('');
    setBrandId('');
    setGroupId('');
    setColor('');
    setModelNo('');
    setTag('');
    setBarcode('');
  };

  const columns: Column<AnalysisRow>[] = [
    {
      key: 'name',
      header: groupLabel,
      sortable: true,
      render: (row) => (
        <span className={`font-semibold ${groupBy === 'barcode' ? 'font-mono text-amber-300' : 'text-white'}`}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'totalQty',
      header: 'Qty Sold',
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
      header: 'Cost',
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
  ];

  return (
    <ReportShell
      title="Product / Category / Barcode Analysis"
      subtitle="Pick any filters and group the sales report the way you want"
      icon={Package}
      exportType="product-analysis"
      startDate={startDate}
      endDate={endDate}
      onDateChange={(s, e) => {
        setStartDate(s);
        setEndDate(e);
      }}
      onRefresh={reload}
      loading={loading}
      error={error}
      extraQuery={extraQuery}
    >
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 print:hidden">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Filters</h3>
            <button
              onClick={reset}
              className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Group by</span>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={FIELD_CLASS}>
                {GROUP_BY.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Category</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={FIELD_CLASS}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Sub-category</span>
              <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} className={FIELD_CLASS}>
                <option value="">All sub-categories</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Brand</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={FIELD_CLASS}>
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Product group</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={FIELD_CLASS}>
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Color</span>
              <select value={color} onChange={(e) => setColor(e.target.value)} className={FIELD_CLASS}>
                <option value="">All colors</option>
                {colors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Model No</span>
              <select value={modelNo} onChange={(e) => setModelNo(e.target.value)} className={FIELD_CLASS}>
                <option value="">All models</option>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Tag</span>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className={FIELD_CLASS}>
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Barcode / SKU</span>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="scan or type a barcode"
                className={FIELD_CLASS}
              />
            </label>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Revenue" value={money(totalRevenue)} tone="emerald" hint="All matching sales" />
          <KpiCard label="Gross Profit" value={money(totalProfit)} tone="indigo" hint="Revenue − cost" />
          <KpiCard label="Qty Sold" value={String(totalQty)} tone="amber" hint="Units in the period" />
          <KpiCard
            label={`Top ${groupLabel}`}
            value={String(data?.summary.top ?? '—')}
            tone="white"
            hint={`${data?.summary.rows ?? 0} row(s) · margin ${avgMargin.toFixed(1)}%`}
          />
        </div>

        {/* Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">
              Revenue vs Gross Profit — top {chartRows.length}
            </h3>
            <span className="text-[11px] text-slate-500">by {groupLabel.toLowerCase()}</span>
          </div>
          {chartRows.length === 0 ? (
            <p className="py-12 text-center text-slate-500 text-sm">No sales match these filters.</p>
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
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                    formatter={(value: any, name: any) => [
                      money(Number(value)),
                      name === 'revenue' ? 'Revenue' : 'Gross Profit',
                    ]}
                  />
                  <Bar dataKey="revenue" name="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name="profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detail table */}
        <DataTable<AnalysisRow>
          columns={columns}
          data={rows}
          keyExtractor={(row, i) => `${row.id || row.name}-${i}`}
          loading={false}
          emptyMessage="No sales match these filters."
        />

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-5 py-3.5">
            <span className="text-xs uppercase tracking-wide text-slate-400 font-bold">
              {rows.length} {groupLabel.toLowerCase()}(s) in this period
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
