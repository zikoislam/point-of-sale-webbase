'use client';

import React from 'react';
import { Building } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';

interface PayablesReport {
  summary: { suppliersWithPayable: number; totalOutstandingPayable: number };
  data: any[];
}

export default function SupplierPayableReportPage() {
  const { data, loading, error, reload } = useReportData<PayablesReport>('/reports/payables');

  const rows = data?.data || [];

  return (
    <ReportShell
      title="Supplier Payable Report"
      subtitle="Outstanding amounts owed to each vendor from received purchase orders"
      icon={Building}
      exportType="payables"
      onRefresh={reload}
      loading={loading}
      error={error}
      showDateFilter={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            label="Total Vendor Accounts Payable"
            value={money(data?.summary.totalOutstandingPayable)}
            tone="amber"
          />
          <KpiCard
            label="Vendors With Payable Balance"
            value={data?.summary.suppliersWithPayable ?? 0}
          />
        </div>

        <ReportTable
          isEmpty={rows.length === 0}
          empty="No supplier is owed money right now."
          headers={[
            { label: 'Supplier Company' },
            { label: 'Contact Person' },
            { label: 'Phone' },
            { label: 'Payable Balance', align: 'right', className: 'font-bold text-amber-400' },
          ]}
        >
          {rows.map((s: any) => (
            <tr key={s.id} className="hover:bg-slate-800/40">
              <td className="py-3 px-4 font-bold text-white">{s.companyName}</td>
              <td className="py-3 px-4 text-slate-300">{s.contactPerson}</td>
              <td className="py-3 px-4 text-slate-400">{s.phone}</td>
              <td className="py-3 px-4 text-right font-black text-amber-400">
                {money(s.currentPayableBalance)}
              </td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </ReportShell>
  );
}
