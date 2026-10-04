'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShoppingCart, RefreshCw } from 'lucide-react';
import { ReportShell, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { ChartCard, RankBars } from '../../../../components/reports/charts';
import { DataTable, Column } from '../../../../components/ui/DataTable';
import { Badge } from '../../../../components/ui/Badge';

interface LowStockRow {
  productName: string;
  variantName?: string;
  sku: string;
  barcode: string | null;
  category: string;
  brand: string;
  unit: string;
  currentStock: number;
  alertQty: number;
  stockValue: number;
  lastSupplier: string | null;
}

interface LowStockReport {
  summary: { totalItems: number; outOfStock: number; totalStockValue: number };
  data: LowStockRow[];
}

export default function LowStockPage() {
  const [threshold, setThreshold] = useState<string>('');
  const [appliedThreshold, setAppliedThreshold] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  const { data, loading, error, reload } = useReportData<LowStockReport>(
    `/reports/low-stock${appliedThreshold ? `?threshold=${appliedThreshold}` : ''}`,
    undefined,
    undefined,
    false
  );

  const rows = data?.data || [];

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort(),
    [rows]
  );
  const suppliers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.lastSupplier || '').filter(Boolean))).sort(),
    [rows]
  );

  const filtered = rows.filter(
    (r) =>
      (!categoryFilter || r.category === categoryFilter) &&
      (!supplierFilter || (r.lastSupplier || '') === supplierFilter)
  );

  const columns: Column<LowStockRow>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{row.productName}</p>
          <p className="text-[11px] text-slate-500">{row.variantName || '—'} · {row.sku}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: true, render: (row) => <span className="text-slate-400">{row.category}</span> },
    { key: 'brand', header: 'Brand', sortable: true, render: (row) => <span className="text-slate-400">{row.brand}</span> },
    {
      key: 'currentStock',
      header: 'Stock',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className={`font-bold ${row.currentStock <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
          {row.currentStock} {row.unit}
        </span>
      ),
    },
    { key: 'alertQty', header: 'Alert Qty', sortable: true, align: 'right', render: (row) => <span className="text-slate-400">{row.alertQty}</span> },
    {
      key: 'stockValue',
      header: 'Stock Value',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-slate-300">{money(row.stockValue)}</span>,
    },
    {
      key: 'lastSupplier',
      header: 'Supplier',
      sortable: true,
      render: (row) => (
        <span className="text-slate-400 text-xs">{row.lastSupplier || <span className="text-slate-600">—</span>}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: () => (
        <Link
          href="/purchase-orders/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
          title="Create a purchase order for this item"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Create PO
        </Link>
      ),
    },
  ];

  return (
    <ReportShell
      title="Low Stock Alert"
      subtitle="Everything at or below its alert quantity — reorder before it runs out"
      icon={AlertTriangle}
      exportType="low-stock"
      onRefresh={reload}
      loading={loading}
      error={error}
      showDateFilter={false}
      extraQuery={threshold ? { threshold } : undefined}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Items Below Alert" value={data?.summary.totalItems ?? 0} tone="amber" />
          <KpiCard label="Out of Stock" value={data?.summary.outOfStock ?? 0} tone="rose" />
          <KpiCard label="Stock Value at Risk" value={money(data?.summary.totalStockValue ?? 0)} tone="white" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold uppercase">Threshold</span>
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="use alert qty"
              className="w-28 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => {
                setAppliedThreshold(threshold.trim());
                reload();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-xs font-semibold"
            >
              <RefreshCw className="w-3 h-3" /> Apply
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold uppercase">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold uppercase">Supplier</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <span className="ml-auto text-[11px] text-slate-500">
            Threshold খালি রাখলে প্রতিটি variant-এর নিজের alert qty ব্যবহার হয়
          </span>
        </div>

        <ChartCard
          title="Biggest shortages"
          subtitle="Units missing to reach each item's alert level"
          height={340}
        >
          <RankBars
            data={filtered.map((r) => ({
              name: `${r.productName}${r.variantName ? ` · ${r.variantName}` : ''}`,
              shortage: Math.max(0, (r.alertQty || 0) - (r.currentStock || 0)),
            }))}
            labelKey="name"
            valueKey="shortage"
            valueFormat={(v) => String(v)}
            color="#f59e0b"
          />
        </ChartCard>

        <DataTable<LowStockRow>
          columns={columns}
          data={filtered}
          keyExtractor={(row) => `${row.sku}-${row.productName}`}
          loading={false}
          emptyMessage="Nothing is running low — every item is above its alert level."
          emptyIcon={<AlertTriangle className="w-10 h-10 text-slate-700 mb-1" />}
        />
      </div>
    </ReportShell>
  );
}
