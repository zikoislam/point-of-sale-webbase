'use client';

import React, { useState } from 'react';
import { PackageX, RefreshCw } from 'lucide-react';
import { ReportShell, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { DataTable, Column } from '../../../../components/ui/DataTable';
import { Badge } from '../../../../components/ui/Badge';

interface DeadStockRow {
  productName: string;
  variantName?: string;
  sku: string;
  category: string;
  brand: string;
  unit: string;
  currentStock: number;
  costPrice: number;
  deadValue: number;
  lastSaleAt: string | null;
  daysSinceLastSale: number | null;
  totalSoldEver: number;
}

interface DeadStockReport {
  summary: { daysSinceLastSale: number; totalItems: number; totalDeadValue: number; totalQty: number };
  data: DeadStockRow[];
}

const DAY_OPTIONS = [30, 60, 90, 180, 365];

export default function DeadStockPage() {
  const [days, setDays] = useState(90);
  const [appliedDays, setAppliedDays] = useState(90);

  const { data, loading, error, reload } = useReportData<DeadStockReport>(
    `/reports/dead-stock?days=${appliedDays}`,
    undefined,
    undefined,
    false
  );

  const rows = data?.data || [];

  const columns: Column<DeadStockRow>[] = [
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
      render: (row) => <span className="font-bold text-white">{row.currentStock} {row.unit}</span>,
    },
    {
      key: 'costPrice',
      header: 'Cost',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-slate-400">{money(row.costPrice)}</span>,
    },
    {
      key: 'deadValue',
      header: 'Tied-up Value',
      sortable: true,
      align: 'right',
      render: (row) => <span className="font-black text-rose-400">{money(row.deadValue)}</span>,
    },
    {
      key: 'daysSinceLastSale',
      header: 'Last Sale',
      sortable: true,
      align: 'center',
      render: (row) =>
        row.daysSinceLastSale === null ? (
          <Badge variant="danger" size="sm">Never sold</Badge>
        ) : (
          <Badge variant={row.daysSinceLastSale > 180 ? 'danger' : 'warning'} size="sm">
            {row.daysSinceLastSale}d ago
          </Badge>
        ),
    },
    {
      key: 'totalSoldEver',
      header: 'Sold (all time)',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-slate-400">{row.totalSoldEver}</span>,
    },
  ];

  return (
    <ReportShell
      title="Dead / Slow-moving Stock"
      subtitle="Stock that has not sold inside the window — cash sitting on the shelf"
      icon={PackageX}
      exportType="dead-stock"
      onRefresh={reload}
      loading={loading}
      error={error}
      showDateFilter={false}
      extraQuery={{ days: String(appliedDays) }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Dead Items" value={data?.summary.totalItems ?? 0} tone="amber" hint={`No sale in ${data?.summary.daysSinceLastSale ?? appliedDays} days`} />
          <KpiCard label="Units Sitting" value={data?.summary.totalQty ?? 0} tone="white" />
          <KpiCard label="Tied-up Capital" value={money(data?.summary.totalDeadValue ?? 0)} tone="rose" hint="At cost price" />
        </div>

        {/* Days filter */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
          <span className="text-xs font-bold uppercase text-slate-400 mr-1">No sale within</span>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setDays(d);
                setAppliedDays(d);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                appliedDays === d
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {d} days
            </button>
          ))}
          <button
            onClick={() => {
              setAppliedDays(days);
              reload();
            }}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-xs font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <DataTable<DeadStockRow>
          columns={columns}
          data={rows}
          keyExtractor={(row) => `${row.sku}-${row.productName}`}
          loading={false}
          emptyMessage="No dead stock — everything sold inside the window."
          emptyIcon={<PackageX className="w-10 h-10 text-slate-700 mb-1" />}
        />
      </div>
    </ReportShell>
  );
}
