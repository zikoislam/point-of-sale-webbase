'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import {
  ChartCard,
  TrendChart,
  ShareDonut,
  groupByDay,
} from '../../../../components/reports/charts';

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
  /** Per-staff performance — who sold how much in the selected period. */
  cashierBreakdown?: Array<{ cashierId: string; name: string; orders: number; totalNet: number; totalDue: number }>;
  /** Wholesale & Retail split — sales per pricing tier. */
  tierBreakdown?: Array<{ _id: string; orders: number; total: number }>;
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <ChartCard title="Net sales by day" subtitle="Invoices in the selected period" height={260}>
              <TrendChart
                data={groupByDay(rows, 'createdAt', 'totalAmount', 'net')}
                xKey="date"
                series={[{ key: 'net', name: 'Net sales', color: '#10b981' }]}
              />
            </ChartCard>
          </div>
          <ChartCard title="Pricing tier split" subtitle="Retail vs wholesale" height={260}>
            <ShareDonut
              data={(data?.tierBreakdown || []).map((t: any) => ({
                name: t._id || 'RETAIL',
                value: t.total,
              }))}
              nameKey="name"
              valueKey="value"
            />
          </ChartCard>
        </div>

        {/* Staff performance — sales per user within the selected period */}
        {(data?.cashierBreakdown || []).length > 0 && (
          <ReportTable
            isEmpty={false}
            headers={[
              { label: 'Staff (Cashier)' },
              { label: 'Invoices', align: 'right' },
              { label: 'Sales Total', align: 'right', className: 'font-bold text-white' },
              { label: 'Dues Created', align: 'right' },
            ]}
          >
            {(data?.cashierBreakdown || []).map((c) => (
              <tr key={c.cashierId} className="hover:bg-slate-800/40">
                <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                <td className="py-3 px-4 text-right text-slate-300">{c.orders}</td>
                <td className="py-3 px-4 text-right font-black text-emerald-400">{money(c.totalNet)}</td>
                <td className="py-3 px-4 text-right font-bold">
                  {c.totalDue > 0 ? <span className="text-rose-400">{money(c.totalDue)}</span> : money(0)}
                </td>
              </tr>
            ))}
          </ReportTable>
        )}

        {/* Wholesale & Retail split — sales per pricing tier */}
        {(data?.tierBreakdown || []).length > 0 && (
          <ReportTable
            isEmpty={false}
            headers={[
              { label: 'Pricing Tier' },
              { label: 'Invoices', align: 'right' },
              { label: 'Sales Total', align: 'right', className: 'font-bold text-white' },
            ]}
          >
            {(data?.tierBreakdown || []).map((t: any) => (
              <tr key={t._id} className="hover:bg-slate-800/40">
                <td className="py-3 px-4 font-bold text-white">{t._id || 'RETAIL'}</td>
                <td className="py-3 px-4 text-right text-slate-300">{t.orders}</td>
                <td className="py-3 px-4 text-right font-black text-emerald-400">{money(t.total)}</td>
              </tr>
            ))}
          </ReportTable>
        )}

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
