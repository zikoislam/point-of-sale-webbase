'use client';

import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';

interface PurchasesReport {
  summary: {
    totalPurchaseOrders: number;
    totalOrderedValue: number;
    totalPaid: number;
    totalDue: number;
  };
  data: any[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  ORDERED: 'bg-indigo-500/20 text-indigo-300',
  PARTIAL: 'bg-amber-500/20 text-amber-300',
  RECEIVED: 'bg-emerald-500/20 text-emerald-300',
  CANCELLED: 'bg-rose-500/20 text-rose-300',
};

export default function PurchasesReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data, loading, error, reload } = useReportData<PurchasesReport>(
    '/reports/purchases',
    startDate,
    endDate
  );

  const rows = data?.data || [];

  return (
    <ReportShell
      title="Purchases Summary"
      subtitle="Purchase orders raised in the period with paid and outstanding amounts"
      icon={Truck}
      exportType="purchases"
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
          <KpiCard label="Purchase Orders" value={data?.summary.totalPurchaseOrders ?? 0} />
          <KpiCard
            label="Total Ordered Value"
            value={money(data?.summary.totalOrderedValue)}
            tone="indigo"
          />
          <KpiCard label="Total Paid" value={money(data?.summary.totalPaid)} tone="emerald" />
          <KpiCard label="Still Owed" value={money(data?.summary.totalDue)} tone="amber" />
        </div>

        <ReportTable
          isEmpty={rows.length === 0}
          empty="No purchase orders raised in this period."
          headers={[
            { label: 'PO #' },
            { label: 'Date' },
            { label: 'Supplier' },
            { label: 'Status', align: 'center' },
            { label: 'Total', align: 'right' },
            { label: 'Paid', align: 'right' },
            { label: 'Due', align: 'right', className: 'font-bold text-white' },
          ]}
        >
          {rows.map((po: any) => (
            <tr key={po._id} className="hover:bg-slate-800/40">
              <td className="py-3 px-4 font-bold text-white">{po.poNumber}</td>
              <td className="py-3 px-4 text-slate-400">
                {new Date(po.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-slate-300">
                {po.supplierId?.companyName || '—'}
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    STATUS_STYLES[po.status] || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {po.status}
                </span>
              </td>
              <td className="py-3 px-4 text-right text-slate-300">{money(po.totalAmount)}</td>
              <td className="py-3 px-4 text-right text-emerald-400">{money(po.paidAmount)}</td>
              <td className="py-3 px-4 text-right font-bold text-amber-400">
                {money(po.dueAmount)}
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
