'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, ShoppingCart } from 'lucide-react';
import { ReportShell, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { DataTable, Column } from '../../../../components/ui/DataTable';
import { Badge } from '../../../../components/ui/Badge';

interface ReorderRow {
  productName: string;
  variantName?: string;
  sku: string;
  unit: string;
  currentStock: number;
  alertQty: number;
  avgDailySales: number;
  avgMonthlySales: number;
  daysLeft: number | null;
  suggestedQty: number;
  supplier: string | null;
  lastPurchasePrice: number;
  estimatedCost: number;
}

interface ReorderReport {
  summary: { totalItems: number; totalEstimatedCost: number };
  data: ReorderRow[];
}

export default function ReorderPointPage() {
  const { data, loading, error, reload } = useReportData<ReorderReport>(
    '/reports/stock-reorder',
    undefined,
    undefined,
    false
  );

  const rows = data?.data || [];

  const columns: Column<ReorderRow>[] = [
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
    {
      key: 'avgDailySales',
      header: 'Avg Daily Sales',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="text-slate-300">
          {row.avgDailySales}
          <span className="text-[10px] text-slate-500"> /day</span>
        </span>
      ),
    },
    {
      key: 'daysLeft',
      header: 'Days Left',
      sortable: true,
      align: 'center',
      render: (row) =>
        row.daysLeft === null ? (
          <Badge variant="neutral" size="sm">No sales</Badge>
        ) : (
          <Badge variant={row.daysLeft <= 7 ? 'danger' : row.daysLeft <= 21 ? 'warning' : 'success'} size="sm">
            {row.daysLeft} days
          </Badge>
        ),
    },
    {
      key: 'suggestedQty',
      header: 'Suggested Qty',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-black text-blue-400">
          {row.suggestedQty}
          <span className="text-[10px] text-slate-500 font-normal"> (2 months cover)</span>
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      render: (row) => (
        <span className="text-slate-400 text-xs">{row.supplier || <span className="text-slate-600">—</span>}</span>
      ),
    },
    {
      key: 'lastPurchasePrice',
      header: 'Last Price',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-slate-400">{money(row.lastPurchasePrice)}</span>,
    },
    {
      key: 'estimatedCost',
      header: 'Est. Cost',
      sortable: true,
      align: 'right',
      render: (row) => <span className="font-bold text-white">{money(row.estimatedCost)}</span>,
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
      title="Reorder Points"
      subtitle="Suggested purchase quantities from the last 90 days of sales — supplier and cost included"
      icon={ClipboardList}
      exportType="stock-reorder"
      onRefresh={reload}
      loading={loading}
      error={error}
      showDateFilter={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <KpiCard label="Items to Reorder" value={data?.summary.totalItems ?? 0} tone="amber" />
          <KpiCard
            label="Estimated Purchase Cost"
            value={money(data?.summary.totalEstimatedCost ?? 0)}
            tone="white"
            hint="Suggested qty × last purchase price"
          />
        </div>

        <DataTable<ReorderRow>
          columns={columns}
          data={rows}
          keyExtractor={(row) => `${row.sku}-${row.productName}`}
          loading={false}
          emptyMessage="Nothing to reorder — all stock levels are healthy."
          emptyIcon={<ClipboardList className="w-10 h-10 text-slate-700 mb-1" />}
        />
      </div>
    </ReportShell>
  );
}
