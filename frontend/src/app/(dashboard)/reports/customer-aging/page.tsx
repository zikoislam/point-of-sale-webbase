'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';

interface DuesReport {
  summary: { customersWithDue: number; totalOutstandingDue: number };
  data: any[];
}

export default function CustomerAgingReportPage() {
  const { data, loading, error, reload } = useReportData<DuesReport>('/reports/dues');

  const rows = data?.data || [];

  return (
    <ReportShell
      title="Customer Due Aging"
      subtitle="Outstanding receivables per customer, with credit-limit risk flags"
      icon={Users}
      exportType="dues"
      onRefresh={reload}
      loading={loading}
      error={error}
      showDateFilter={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            label="Total Customer Receivables"
            value={money(data?.summary.totalOutstandingDue)}
            tone="rose"
          />
          <KpiCard
            label="Customers With Active Balance"
            value={data?.summary.customersWithDue ?? 0}
          />
        </div>

        <ReportTable
          isEmpty={rows.length === 0}
          empty="No customer is carrying an outstanding balance."
          headers={[
            { label: 'Customer Name' },
            { label: 'Phone' },
            { label: 'Credit Limit', align: 'right' },
            { label: 'Current Due', align: 'right', className: 'font-bold text-rose-400' },
            { label: 'Credit Risk', align: 'center' },
          ]}
        >
          {rows.map((c: any) => (
            <tr key={c.id} className="hover:bg-slate-800/40">
              <td className="py-3 px-4 font-bold text-white">{c.name}</td>
              <td className="py-3 px-4 text-slate-300">{c.phone}</td>
              <td className="py-3 px-4 text-right text-slate-300">{money(c.creditLimit)}</td>
              <td className="py-3 px-4 text-right font-black text-rose-400">
                {money(c.currentDueBalance)}
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    c.riskLevel === 'HIGH_RISK'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {c.riskLevel}
                </span>
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
