'use client';

import React, { useState } from 'react';
import { Boxes } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';

interface InventoryReport {
  summary: {
    totalVariants: number;
    totalStockQty: number;
    totalValuation: number;
  };
  data: any[];
}

export default function InventoryReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data, loading, error, reload } = useReportData<InventoryReport>('/reports/inventory');

  const rows = data?.data || [];

  return (
    <ReportShell
      title="Stock Valuation Report"
      subtitle="Weighted-average cost valuation of every tracked variant currently on hand"
      icon={Boxes}
      exportType="inventory"
      onRefresh={reload}
      loading={loading}
      error={error}
      showDateFilter={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Total Asset Valuation"
            value={money(data?.summary.totalValuation)}
            tone="emerald"
          />
          <KpiCard
            label="Total Stock On-Hand"
            value={`${data?.summary.totalStockQty ?? 0} units`}
          />
          <KpiCard
            label="Tracked Variants"
            value={data?.summary.totalVariants ?? 0}
            tone="purple"
          />
        </div>

        <ReportTable
          isEmpty={rows.length === 0}
          empty="No product variants found."
          headers={[
            { label: 'Product' },
            { label: 'SKU' },
            { label: 'Cost (WAC)', align: 'right' },
            { label: 'Retail', align: 'right' },
            { label: 'Stock', align: 'center' },
            { label: 'Asset Valuation', align: 'right', className: 'font-bold text-white' },
            { label: 'Status', align: 'center' },
          ]}
        >
          {rows.map((i: any, idx: number) => (
            <tr key={idx} className="hover:bg-slate-800/40">
              <td className="py-3 px-4">
                <div className="font-bold text-white">{i.productName}</div>
                <div className="text-slate-400">{i.variantName}</div>
              </td>
              <td className="py-3 px-4 font-mono text-slate-300">{i.sku}</td>
              <td className="py-3 px-4 text-right text-slate-300">{money(i.costPrice)}</td>
              <td className="py-3 px-4 text-right text-slate-300">{money(i.retailPrice)}</td>
              <td className="py-3 px-4 text-center font-bold text-white">
                {i.currentStock} {i.unit}
              </td>
              <td className="py-3 px-4 text-right font-black text-emerald-400">
                {money(i.assetValue)}
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    i.status === 'LOW_STOCK'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {i.status}
                </span>
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
