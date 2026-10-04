'use client';

import React, { useState } from 'react';
import { Truck, Undo2 } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData, REPORT_API } from '../../../../components/reports/useReportData';
import { ChartCard, TrendChart, groupByDay } from '../../../../components/reports/charts';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

interface PurchasesReport {
  summary: {
    totalPurchaseOrders: number;
    totalOrderedValue: number;
    totalPaid: number;
    totalDue: number;
  };
  data: any[];
}

interface ReturnsResponse {
  data: any[];
  total: number;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  ORDERED: 'bg-indigo-500/20 text-indigo-300',
  PARTIAL: 'bg-amber-500/20 text-amber-300',
  RECEIVED: 'bg-emerald-500/20 text-emerald-300',
  CANCELLED: 'bg-rose-500/20 text-rose-300',
};

export default function PurchasesReportPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [returnStatus, setReturnStatus] = useState('');

  const { data, loading, error, reload } = useReportData<PurchasesReport>(
    '/reports/purchases',
    startDate,
    endDate
  );

  // Purchase returns tab — fetched from the dedicated endpoint (with filters)
  const returnsQuery = new URLSearchParams({
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(returnStatus ? { status: returnStatus } : {}),
  }).toString();

  const {
    data: returnsData,
    loading: returnsLoading,
    error: returnsError,
    reload: reloadReturns,
  } = useReportData<ReturnsResponse>(
    `/purchase-returns?${returnsQuery}`,
    undefined,
    undefined,
    false
  );

  const rows = data?.data || [];
  const returnRows = returnsData?.data || [];
  const returnsTotal = returnRows.reduce((n: number, r: any) => n + (r.totalAmount || 0), 0);

  return (
    <ReportShell
      title="Purchases Summary"
      subtitle="Purchase orders raised in the period — and what went back to suppliers"
      icon={Truck}
      exportType="purchases"
      startDate={startDate}
      endDate={endDate}
      onDateChange={(s, e) => {
        setStartDate(s);
        setEndDate(e);
      }}
      onRefresh={activeTab === 'summary' ? reload : reloadReturns}
      loading={activeTab === 'summary' ? loading : returnsLoading}
      error={activeTab === 'summary' ? error : returnsError}
    >
      <div className="space-y-4">
        <Tabs
          tabs={[
            { key: 'summary', label: 'Purchase Orders', icon: <Truck className="w-3.5 h-3.5" /> },
            { key: 'returns', label: 'Purchase Returns', count: returnsData?.total, icon: <Undo2 className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
        />

        {activeTab === 'summary' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Purchase Orders" value={data?.summary.totalPurchaseOrders ?? 0} />
              <KpiCard label="Total Ordered Value" value={money(data?.summary.totalOrderedValue)} tone="indigo" />
              <KpiCard label="Total Paid" value={money(data?.summary.totalPaid)} tone="emerald" />
              <KpiCard label="Still Owed" value={money(data?.summary.totalDue)} tone="amber" />
            </div>

            <ChartCard title="Purchase value by day" subtitle="Ordered value raised each day" height={260}>
              <TrendChart
                data={groupByDay(rows, 'createdAt', 'totalAmount', 'purchase')}
                xKey="date"
                series={[{ key: 'purchase', name: 'Purchase value', color: '#6366f1' }]}
              />
            </ChartCard>

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
                  <td className="py-3 px-4 text-slate-400">{new Date(po.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-slate-300">{po.supplierId?.companyName || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[po.status] || 'bg-slate-800 text-slate-300'}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">{money(po.totalAmount)}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">{money(po.paidAmount)}</td>
                  <td className="py-3 px-4 text-right font-bold text-amber-400">{money(po.dueAmount)}</td>
                </tr>
              ))}
            </ReportTable>
          </>
        )}

        {activeTab === 'returns' && (
          <>
            <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
              <div className="grid grid-cols-2 gap-3 flex-1 min-w-[240px]">
                <KpiCard label="Returns in period" value={returnsData?.total ?? returnRows.length} tone="amber" />
                <KpiCard label="Total Debit Notes" value={money(returnsTotal)} tone="rose" />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold uppercase">Status</span>
                <select
                  value={returnStatus}
                  onChange={(e) => setReturnStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
            </div>

            <ReportTable
              isEmpty={returnRows.length === 0}
              empty="No purchase returns (debit notes) in this period."
              headers={[
                { label: 'Debit Note #' },
                { label: 'Date' },
                { label: 'Supplier' },
                { label: 'Against PO' },
                { label: 'Items' },
                { label: 'Refund Method' },
                { label: 'Status', align: 'center' },
                { label: 'Total', align: 'right', className: 'font-bold text-white' },
              ]}
            >
              {returnRows.map((ret: any) => (
                <tr key={ret._id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white">{ret.returnNumber}</td>
                  <td className="py-3 px-4 text-slate-400">{new Date(ret.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-slate-300">{ret.supplierId?.companyName || '—'}</td>
                  <td className="py-3 px-4 text-slate-400">{ret.purchaseOrderId?.poNumber || '—'}</td>
                  <td className="py-3 px-4 text-slate-400">{(ret.items || []).length}</td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">{String(ret.refundMethod || '').replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={ret.status === 'REFUNDED' ? 'success' : ret.status === 'DRAFT' ? 'info' : 'warning'} size="sm">
                      {ret.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-rose-300">{money(ret.totalAmount)}</td>
                </tr>
              ))}
            </ReportTable>
          </>
        )}
      </div>
    </ReportShell>
  );
}
