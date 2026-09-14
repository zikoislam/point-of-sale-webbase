'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';

interface WastageReport {
  summary: { totalWastageEvents: number; totalQty: number; totalLossValue: number };
  data: any[];
}

export default function WastageReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data, loading, error, reload } = useReportData<WastageReport>(
    '/reports/inventory-wastage',
    startDate,
    endDate
  );

  const rows = data?.data || [];

  return (
    <ReportShell
      title="Wastage & Shrinkage Report"
      subtitle="Damaged, expired and written-off stock valued at weighted-average cost"
      icon={Trash2}
      exportType="wastage"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Wastage Events"
            value={data?.summary.totalWastageEvents ?? 0}
            tone="white"
          />
          <KpiCard label="Total Units Written Off" value={data?.summary.totalQty ?? 0} />
          <KpiCard
            label="Total Loss Value"
            value={money(data?.summary.totalLossValue)}
            tone="rose"
          />
        </div>

        <ReportTable
          isEmpty={rows.length === 0}
          empty="No wastage recorded in this period."
          headers={[
            { label: 'Product' },
            { label: 'Qty' },
            { label: 'Unit Cost', align: 'right' },
            { label: 'Loss Value', align: 'right', className: 'font-bold text-white' },
            { label: 'Reason' },
            { label: 'Recorded By' },
            { label: 'Date' },
          ]}
        >
          {rows.map((m: any) => (
            <tr key={m.id} className="hover:bg-slate-800/40">
              <td className="py-3 px-4 font-bold text-white">{m.productName}</td>
              <td className="py-3 px-4 text-slate-300">
                {m.quantity} {m.unit}
              </td>
              <td className="py-3 px-4 text-right text-slate-300">{money(m.unitCost)}</td>
              <td className="py-3 px-4 text-right font-black text-rose-400">
                {money(m.lossValue)}
              </td>
              <td className="py-3 px-4 text-slate-400">{m.reason || '—'}</td>
              <td className="py-3 px-4 text-slate-400">{m.recordedBy || '—'}</td>
              <td className="py-3 px-4 text-slate-400">
                {new Date(m.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
