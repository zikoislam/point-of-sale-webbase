'use client';

import React, { useMemo, useState } from 'react';
import { Boxes, Layers, Tags, FolderTree, Hourglass } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Treemap,
} from 'recharts';
import { ReportShell, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { DataTable, Column } from '../../../../components/ui/DataTable';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

type InventoryTab = 'all' | 'category' | 'brand' | 'group' | 'aging';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#84cc16', '#f43f5e', '#0ea5e9', '#a855f7'];

interface ValuationReport {
  summary: { totalVariants: number; totalStockQty: number; totalValuation: number };
  data: any[];
}

interface SummaryReport {
  summary: { totalGroups?: number; totalItems?: number; totalQty: number; totalAssetValue: number };
  data: any[];
}

interface AgingReport {
  summary: {
    buckets: Array<{ bucket: string; items: number; totalQty: number; totalAssetValue: number }>;
    totalItems: number;
    totalQty: number;
    totalAssetValue: number;
    oldestDays: number;
  };
  data: Array<{ bucket: string; items: number; totalQty: number; totalAssetValue: number }>;
  items: any[];
}

export default function InventoryReportPage() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Filter options
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  React.useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/categories`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setCategories((j?.data || []).map((c: any) => ({ id: c.id || c._id, name: c.name }))))
      .catch(() => {});
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/brands`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setBrands((j?.data || []).map((b: any) => ({ id: b.id || b._id, name: b.name }))))
      .catch(() => {});
  }, []);

  // Endpoint per tab / filter
  const endpoint = useMemo(() => {
    if (activeTab === 'all') return '/reports/inventory';
    if (activeTab === 'category') return `/reports/inventory-by-category${selectedCategoryId ? `?categoryId=${selectedCategoryId}` : ''}`;
    if (activeTab === 'brand') return `/reports/inventory-by-brand${selectedBrandId ? `?brandId=${selectedBrandId}` : ''}`;
    if (activeTab === 'group') return '/reports/inventory-by-group';
    return '/reports/inventory-aging';
  }, [activeTab, selectedCategoryId, selectedBrandId]);

  const isSummaryTab = activeTab === 'category' || activeTab === 'brand' || activeTab === 'group';
  const summaryFilterActive = (activeTab === 'category' && !!selectedCategoryId) || (activeTab === 'brand' && !!selectedBrandId);

  const { data: valuation, loading: loadingAll, error: errAll, reload: reloadAll } = useReportData<ValuationReport>(
    '/reports/inventory',
    undefined,
    undefined,
    false
  );
  const { data: summaryData, loading, error, reload } = useReportData<SummaryReport>(endpoint, undefined, undefined, false);
  const { data: aging, loading: agingLoading, error: agingError, reload: reloadAging } = useReportData<AgingReport>(
    '/reports/inventory-aging',
    undefined,
    undefined,
    false
  );

  const exportType =
    activeTab === 'all'
      ? 'inventory'
      : activeTab === 'category'
      ? 'inventory-by-category'
      : activeTab === 'brand'
      ? 'inventory-by-brand'
      : activeTab === 'group'
      ? 'inventory-by-group'
      : 'inventory-aging';

  const extraQuery: Record<string, string> = {
    ...(activeTab === 'category' && selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
    ...(activeTab === 'brand' && selectedBrandId ? { brandId: selectedBrandId } : {}),
  };

  const valuationRows = valuation?.data || [];
  const summaryRows = summaryData?.data || [];

  // Detail rows shown when a category/brand filter narrows the view
  const detailMode = isSummaryTab && summaryFilterActive;
  const agingRows = aging?.data || [];
  const agingItems = aging?.items || [];

  // ── columns ──────────────────────────────────────────────────────────────
  const valuationColumns: Column<any>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-bold text-white">{r.productName}</p>
          <p className="text-slate-400">{r.variantName}</p>
        </div>
      ),
    },
    { key: 'categoryName', header: 'Category', sortable: true, render: (r) => <span className="text-slate-400">{r.categoryName}</span> },
    { key: 'sku', header: 'SKU', sortable: true, render: (r) => <span className="font-mono text-slate-300">{r.sku}</span> },
    { key: 'costPrice', header: 'Cost (WAC)', sortable: true, align: 'right', render: (r) => <span className="text-slate-300">{money(r.costPrice)}</span> },
    {
      key: 'currentStock',
      header: 'Stock',
      sortable: true,
      align: 'center',
      render: (r) => <span className="font-bold text-white">{r.currentStock} {r.unit}</span>,
    },
    {
      key: 'assetValue',
      header: 'Asset Valuation',
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-black text-emerald-400">{money(r.assetValue)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (r) => <Badge variant={r.status === 'LOW_STOCK' ? 'danger' : 'success'} size="sm">{r.status}</Badge>,
    },
  ];

  const summaryColumns: Column<any>[] = [
    { key: 'name', header: activeTab === 'group' ? 'Product Group' : activeTab === 'brand' ? 'Brand' : 'Category', sortable: true, render: (r) => <span className="font-semibold text-white">{r.name}</span> },
    { key: 'productCount', header: 'Products', sortable: true, align: 'right', render: (r) => <span className="text-slate-300">{r.productCount ?? 0}</span> },
    { key: 'variantCount', header: 'Variants', sortable: true, align: 'right', render: (r) => <span className="text-slate-400">{r.variantCount ?? 0}</span> },
    { key: 'totalQty', header: 'Qty On Hand', sortable: true, align: 'right', render: (r) => <span className="text-slate-300">{r.totalQty}</span> },
    { key: 'totalAssetValue', header: 'Asset Value', sortable: true, align: 'right', render: (r) => <span className="font-black text-emerald-400">{money(r.totalAssetValue)}</span> },
    ...(activeTab !== 'group'
      ? [{
          key: 'retailValue',
          header: 'Retail Value',
          sortable: true,
          align: 'right' as const,
          render: (r: any) => <span className="text-slate-400">{money(r.retailValue)}</span>,
        }]
      : []),
  ];

  const detailColumns: Column<any>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-bold text-white">{r.productName}</p>
          <p className="text-slate-400 text-[11px]">{r.variantName}</p>
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', sortable: true, render: (r) => <span className="font-mono text-slate-300">{r.sku}</span> },
    { key: 'currentStock', header: 'Stock', sortable: true, align: 'right', render: (r) => <span className="font-bold text-white">{r.currentStock} {r.unit}</span> },
    { key: 'costPrice', header: 'Cost', sortable: true, align: 'right', render: (r) => <span className="text-slate-400">{money(r.costPrice)}</span> },
    { key: 'retailPrice', header: 'Retail', sortable: true, align: 'right', render: (r) => <span className="text-slate-400">{money(r.retailPrice)}</span> },
    { key: 'assetValue', header: 'Asset Value', sortable: true, align: 'right', render: (r) => <span className="font-black text-emerald-400">{money(r.assetValue)}</span> },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (r) => <Badge variant={r.status === 'LOW_STOCK' ? 'danger' : 'success'} size="sm">{r.status}</Badge>,
    },
  ];

  const agingColumns: Column<any>[] = [
    { key: 'bucket', header: 'Age Bucket', sortable: true, render: (r) => <span className="font-bold text-white">{r.bucket} days</span> },
    { key: 'items', header: 'Items', sortable: true, align: 'right', render: (r) => <span className="text-slate-300">{r.items}</span> },
    { key: 'totalQty', header: 'Qty', sortable: true, align: 'right', render: (r) => <span className="text-slate-300">{r.totalQty}</span> },
    { key: 'totalAssetValue', header: 'Asset Value', sortable: true, align: 'right', render: (r) => <span className="font-black text-emerald-400">{money(r.totalAssetValue)}</span> },
  ];

  const agingItemColumns: Column<any>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-bold text-white">{r.productName}</p>
          <p className="text-slate-400 text-[11px]">{r.variantName} · {r.sku}</p>
        </div>
      ),
    },
    { key: 'currentStock', header: 'Stock', sortable: true, align: 'right', render: (r) => <span className="font-bold text-white">{r.currentStock}</span> },
    {
      key: 'ageDays',
      header: 'Age (days)',
      sortable: true,
      align: 'center',
      render: (r) => (
        <Badge variant={r.ageDays > 90 ? 'danger' : r.ageDays > 60 ? 'warning' : 'success'} size="sm">
          {r.ageDays} days
        </Badge>
      ),
    },
    { key: 'bucket', header: 'Bucket', sortable: true, align: 'center', render: (r) => <span className="text-slate-400">{r.bucket}</span> },
    { key: 'assetValue', header: 'Asset Value', sortable: true, align: 'right', render: (r) => <span className="text-emerald-400">{money(r.assetValue)}</span> },
  ];

  // ── chart data ───────────────────────────────────────────────────────────
  const pieData = summaryRows
    .filter((r) => (r.totalAssetValue || 0) > 0)
    .map((r) => ({ name: r.name, value: r.totalAssetValue }));
  const treemapData = summaryRows
    .filter((r) => (r.totalAssetValue || 0) > 0)
    .map((r) => ({ name: r.name, size: r.totalAssetValue }));

  const activeLoading = activeTab === 'all' ? loadingAll : activeTab === 'aging' ? agingLoading : loading;
  const activeError = activeTab === 'all' ? errAll : activeTab === 'aging' ? agingError : error;
  const activeReload = activeTab === 'all' ? reloadAll : activeTab === 'aging' ? reloadAging : reload;

  return (
    <ReportShell
      title="Inventory Analysis"
      subtitle="Valuation by category, brand, product group — plus how long stock has been aging"
      icon={Boxes}
      exportType={exportType}
      extraQuery={Object.keys(extraQuery).length ? extraQuery : undefined}
      onRefresh={activeReload}
      loading={activeLoading}
      error={activeError}
      showDateFilter={false}
    >
      <div className="space-y-4">
        {/* Tabs */}
        <Tabs
          tabs={[
            { key: 'all', label: 'All', icon: <Boxes className="w-3.5 h-3.5" /> },
            { key: 'category', label: 'By Category', icon: <Layers className="w-3.5 h-3.5" /> },
            { key: 'brand', label: 'By Brand', icon: <Tags className="w-3.5 h-3.5" /> },
            { key: 'group', label: 'By Group', icon: <FolderTree className="w-3.5 h-3.5" /> },
            { key: 'aging', label: 'Aging', icon: <Hourglass className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as InventoryTab)}
          variant="pills"
        />

        {/* Filters for category / brand tabs */}
        {(activeTab === 'category' || activeTab === 'brand') && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
            {activeTab === 'category' ? (
              <>
                <span className="text-xs font-bold uppercase text-slate-400">Category</span>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 min-w-[200px]"
                >
                  <option value="">All categories (summary)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <span className="text-xs font-bold uppercase text-slate-400">Brand</span>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 min-w-[200px]"
                >
                  <option value="">All brands (summary)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </>
            )}
            <span className="text-[11px] text-slate-500">
              {summaryFilterActive ? 'Showing every variant in the selection' : 'Showing one summary row per group'}
            </span>
          </div>
        )}

        {/* ── All tab ── */}
        {activeTab === 'all' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard label="Total Asset Valuation" value={money(valuation?.summary.totalValuation)} tone="emerald" />
              <KpiCard label="Total Stock On-Hand" value={`${valuation?.summary.totalStockQty ?? 0} units`} />
              <KpiCard label="Tracked Variants" value={valuation?.summary.totalVariants ?? 0} tone="purple" />
            </div>
            <DataTable<any>
              columns={valuationColumns}
              data={valuationRows}
              keyExtractor={(r, i) => `${r.sku}-${i}`}
              emptyMessage="No product variants found."
            />
          </>
        )}

        {/* ── By Category / By Brand / By Group ── */}
        {isSummaryTab && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard label="Total Asset Value" value={money(summaryData?.summary.totalAssetValue ?? 0)} tone="emerald" />
              <KpiCard label="Total Qty On Hand" value={summaryData?.summary.totalQty ?? 0} />
              <KpiCard
                label={detailMode ? 'Items' : activeTab === 'group' ? 'Product Groups' : `${activeTab === 'brand' ? 'Brands' : 'Categories'}`}
                value={(detailMode ? summaryData?.summary.totalItems : summaryData?.summary.totalGroups) ?? summaryRows.length}
                tone="purple"
              />
            </div>

            {/* Pie chart on the category/brand tabs, Treemap on group */}
            {!detailMode && activeTab !== 'group' && pieData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm font-bold text-white mb-2">
                  Asset value share by {activeTab === 'brand' ? 'brand' : 'category'}
                </h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={55}
                        paddingAngle={2}
                        label={(entry: any) => `${entry.name} (${Math.round((entry.percent || 0) * 100)}%)`}
                        labelLine={false}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                        formatter={(v: any) => money(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!detailMode && activeTab === 'group' && treemapData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm font-bold text-white mb-2">Inventory breakdown by product group</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      nameKey="name"
                      stroke="#0f172a"
                      fill="#6366f1"
                      aspectRatio={4 / 3}
                      content={<TreemapCell />}
                    />
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {detailMode ? (
              <DataTable<any>
                columns={detailColumns}
                data={summaryRows}
                keyExtractor={(r, i) => `${r.sku}-${i}`}
                emptyMessage="No variants in this selection."
              />
            ) : (
              <DataTable<any>
                columns={summaryColumns}
                data={summaryRows}
                keyExtractor={(r, i) => `${r.name}-${i}`}
                emptyMessage="Nothing in stock for this breakdown."
              />
            )}
          </>
        )}

        {/* ── Aging tab ── */}
        {activeTab === 'aging' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard label="Total Asset Value" value={money(aging?.summary.totalAssetValue ?? 0)} tone="emerald" />
              <KpiCard label="Oldest Stock Age" value={`${aging?.summary.oldestDays ?? 0} days`} tone="rose" hint="Since its last purchase receipt" />
              <KpiCard label="Items On Hand" value={aging?.summary.totalItems ?? 0} tone="purple" />
            </div>

            <DataTable<any>
              columns={agingColumns}
              data={agingRows}
              keyExtractor={(r) => r.bucket}
              emptyMessage="No stock on hand."
            />

            <div>
              <h3 className="text-sm font-bold text-white mb-2">Oldest items first</h3>
              <DataTable<any>
                columns={agingItemColumns}
                data={agingItems.slice(0, 200)}
                keyExtractor={(r, i) => `${r.sku}-${i}`}
                emptyMessage="Nothing on hand."
              />
            </div>
          </>
        )}
      </div>
    </ReportShell>
  );
}

/** Custom treemap tile — coloured, labelled, with the value underneath. */
function TreemapCell(props: any) {
  const { x, y, width, height, index, name, size } = props;
  if (width < 4 || height < 4) return null;
  const fill = PIE_COLORS[index % PIE_COLORS.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} fill={fill} fillOpacity={0.85} stroke="#0f172a" strokeWidth={2} />
      {width > 90 && height > 40 && (
        <>
          <text x={x + 10} y={y + 22} fill="#ffffff" fontSize={12} fontWeight={700}>
            {String(name).length > 18 ? `${String(name).slice(0, 18)}…` : name}
          </text>
          <text x={x + 10} y={y + 40} fill="#e2e8f0" fontSize={11}>
            {money(Number(size))}
          </text>
        </>
      )}
    </g>
  );
}
