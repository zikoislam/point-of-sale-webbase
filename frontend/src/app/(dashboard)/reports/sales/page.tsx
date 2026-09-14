'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';

interface SalesReport {
  summary: {
    totalOrders: number;
    totalGross: number;
    totalTax: number;
    totalDiscount: number;
    totalNet: number;
    totalPaid: number;
    totalDue: number;
  };
  data: any[];
}

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data, loading, error, reload } = useReportData<SalesReport>(
    '/reports/sales',
    startDate,
    endDate
  );

  const rows = data?.data || [];

  return (
    <ReportShell
      title="Sales Summary Report"
      subtitle="Invoice-level revenue, VAT collected and outstanding dues for the selected period"
      icon={TrendingUp}
      exportType="sales"
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
          <KpiCard label="Net Revenue" value={money(data?.summary.totalNet)} tone="emerald" />
          <KpiCard label="Invoices Finalized" value={data?.summary.totalOrders ?? 0} />
          <KpiCard label="VAT Collected" value={money(data?.summary.totalTax)} tone="indigo" />
          <KpiCard label="Discounts Given" value={money(data?.summary.totalDiscount)} tone="amber" />
          <KpiCard
            label="Gross (before discount)"
            value={money(data?.summary.totalGross)}
            tone="white"
          />
          <KpiCard label="Total Collected" value={money(data?.summary.totalPaid)} tone="emerald" />
          <KpiCard label="Unpaid Dues" value={money(data?.summary.totalDue)} tone="rose" />
        </div>

        <ReportTable
          isEmpty={rows.length === 0}
          empty="No invoices recorded in this period."
          headers={[
            { label: 'Invoice #' },
            { label: 'Date' },
            { label: 'Gross', align: 'right' },
            { label: 'Tax', align: 'right' },
            { label: 'Discount', align: 'right' },
            { label: 'Net Total', align: 'right', className: 'font-bold text-white' },
            { label: 'Paid', align: 'right' },
            { label: 'Due', align: 'right' },
          ]}
        >
          {rows.map((s: any) => (
            <tr key={s._id} className="hover:bg-slate-800/40">
              <td className="py-3 px-4 font-bold text-white">{s.invoiceNo}</td>
              <td className="py-3 px-4 text-slate-400">
                {new Date(s.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-right text-slate-300">{money(s.subtotal)}</td>
              <td className="py-3 px-4 text-right text-slate-300">{money(s.totalTax)}</td>
              <td className="py-3 px-4 text-right text-slate-300">{money(s.discountAmount)}</td>
              <td className="py-3 px-4 text-right font-black text-emerald-400">
                {money(s.totalAmount)}
              </td>
              <td className="py-3 px-4 text-right text-slate-300">{money(s.paidAmount)}</td>
              <td className="py-3 px-4 text-right font-bold">
                {s.dueAmount > 0 ? (
                  <span className="text-rose-400">{money(s.dueAmount)}</span>
                ) : (
                  money(0)
                )}
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
