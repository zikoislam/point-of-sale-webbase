'use client';

import React, { useState } from 'react';
import { Truck, PackageSearch, ArrowLeftRight } from 'lucide-react';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData } from '../../../../components/reports/useReportData';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

/**
 * Purchase analysis — the buying side in three views:
 * who we buy from, which supplier is cheapest for a product, and whether
 * purchases are keeping pace with sales.
 */
type TabKey = 'suppliers' | 'products' | 'turnover';

const ENDPOINTS: Record<TabKey, string> = {
  suppliers: '/reports/supplier-wise-purchases',
  products: '/reports/supplier-price-comparison',
  turnover: '/reports/purchase-vs-sales',
};

interface SupplierRow {
  supplierId: string;
  supplierName: string;
  phone?: string;
  poCount: number;
  openOrders: number;
  orderedQty: number;
  receivedQty: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  outstanding: number;
  revenueShare: number;
  avgLeadTimeDays: number | null;
  avgOrderValue: number;
}

interface SupplierReport {
  summary: {
    suppliers: number;
    totalPurchase: number;
    totalPaid: number;
    totalDue: number;
    openOrders: number;
    avgLeadTimeDays: number | null;
    topSupplier: string | null;
  };
  data: SupplierRow[];
}

interface ComparisonSupplier {
  supplierName: string | null;
  lastPrice: number;
  minPrice: number;
  maxPrice: number;
  totalQty: number;
  orders: number;
  isCheapest: boolean;
}

interface ComparisonRow {
  productName: string;
  sku?: string;
  cheapestPrice: number;
  dearestPrice: number;
  spread: number;
  spreadPercent: number;
  bestSupplier: string | null;
  supplierCount: number;
  suppliers: ComparisonSupplier[];
}

interface ComparisonReport {
  summary: { products: number; multiSupplierProducts: number; avgSpreadPercent: number };
  data: ComparisonRow[];
}

interface TurnoverRow {
  month: string;
  salesValue: number;
  purchaseValue: number;
  difference: number;
  ratio: number | null;
}

interface TurnoverReport {
  summary: {
    totalSales: number;
    totalPurchases: number;
    cogs: number;
    stockValue: number;
    turnoverRatio: number | null;
  };
  data: TurnoverRow[];
}

export default function PurchaseAnalysisPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('suppliers');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, loading, error, reload } = useReportData<any>(ENDPOINTS[activeTab], startDate, endDate);

  const suppliers: SupplierReport | null = activeTab === 'suppliers' ? data : null;
  const comparison: ComparisonReport | null = activeTab === 'products' ? data : null;
  const turnover: TurnoverReport | null = activeTab === 'turnover' ? data : null;

  return (
    <ReportShell
      title="Purchase Analysis"
      subtitle="Supplier spend and lead times, price comparison per product, and purchases against sales"
      icon={Truck}
      exportType={ENDPOINTS[activeTab].replace('/reports/', '')}
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
        <Tabs
          tabs={[
            { key: 'suppliers', label: 'Supplier Analysis', icon: <Truck className="w-3.5 h-3.5" /> },
            { key: 'products', label: 'Product Comparison', icon: <PackageSearch className="w-3.5 h-3.5" /> },
            { key: 'turnover', label: 'Purchase vs Sales', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
          variant="pills"
        />

        {/* ── Supplier analysis ── */}
        {suppliers && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total Purchases"
                value={money(suppliers.summary.totalPurchase)}
                tone="emerald"
                hint={`${suppliers.summary.suppliers} suppliers`}
              />
              <KpiCard label="Total Paid" value={money(suppliers.summary.totalPaid)} tone="indigo" />
              <KpiCard
                label="Outstanding on Orders"
                value={money(suppliers.summary.totalDue)}
                tone="rose"
                hint={`${suppliers.summary.openOrders} open order(s)`}
              />
              <KpiCard
                label="Avg Lead Time"
                value={suppliers.summary.avgLeadTimeDays === null ? '—' : `${suppliers.summary.avgLeadTimeDays} d`}
                tone="amber"
                hint={suppliers.summary.topSupplier ? `Top: ${suppliers.summary.topSupplier}` : undefined}
              />
            </div>

            <ReportTable
              headers={[
                { label: 'Supplier' },
                { label: 'POs', align: 'right' },
                { label: 'Open', align: 'right' },
                { label: 'Received Qty', align: 'right' },
                { label: 'Purchased', align: 'right' },
                { label: 'Paid', align: 'right' },
                { label: 'Due', align: 'right' },
                { label: 'Lead (days)', align: 'right' },
                { label: 'Share', align: 'right' },
              ]}
              isEmpty={suppliers.data.length === 0}
              empty="No purchase orders in this period."
            >
              {suppliers.data.map((r) => (
                <tr key={r.supplierId} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white">{r.supplierName}</span>
                    {r.phone && <span className="ml-2 text-[11px] text-slate-500">{r.phone}</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">{r.poCount}</td>
                  <td className="py-3 px-4 text-right text-slate-400">{r.openOrders || '—'}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{r.receivedQty}</td>
                  <td className="py-3 px-4 text-right font-bold text-white">{money(r.totalAmount)}</td>
                  <td className="py-3 px-4 text-right text-emerald-300">{money(r.paidAmount)}</td>
                  <td className={`py-3 px-4 text-right ${r.dueAmount > 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                    {money(r.dueAmount)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {r.avgLeadTimeDays === null ? '—' : r.avgLeadTimeDays}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant={r.revenueShare >= 25 ? 'success' : 'info'} size="sm">
                      {r.revenueShare}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </ReportTable>
          </>
        )}

        {/* ── Product / supplier price comparison ── */}
        {comparison && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard label="Products Compared" value={String(comparison.summary.products)} tone="indigo" />
              <KpiCard
                label="Multi-supplier Products"
                value={String(comparison.summary.multiSupplierProducts)}
                tone="amber"
                hint="Products a second supplier also quotes"
              />
              <KpiCard
                label="Average Price Spread"
                value={`${comparison.summary.avgSpreadPercent}%`}
                tone="emerald"
                hint="Dearest vs cheapest last price"
              />
            </div>

            <ReportTable
              headers={[
                { label: 'Product' },
                { label: 'SKU' },
                { label: 'Cheapest', align: 'right' },
                { label: 'Dearest', align: 'right' },
                { label: 'Spread', align: 'right' },
                { label: 'Best supplier' },
                { label: 'Suppliers', align: 'right' },
              ]}
              isEmpty={comparison.data.length === 0}
              empty="No supplier prices recorded yet."
            >
              {comparison.data.map((r) => (
                <tr key={`${r.sku || r.productName}`} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white">{r.productName}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{r.sku || '—'}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-300">{money(r.cheapestPrice)}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{money(r.dearestPrice)}</td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant={r.spreadPercent >= 15 ? 'danger' : r.spreadPercent > 0 ? 'warning' : 'success'} size="sm">
                      {r.spreadPercent}%
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{r.bestSupplier || '—'}</td>
                  <td className="py-3 px-4 text-right text-slate-400">{r.supplierCount}</td>
                </tr>
              ))}
            </ReportTable>
          </>
        )}

        {/* ── Purchase vs sales ── */}
        {turnover && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Sales" value={money(turnover.summary.totalSales)} tone="emerald" />
              <KpiCard label="Total Purchases" value={money(turnover.summary.totalPurchases)} tone="indigo" />
              <KpiCard label="COGS" value={money(turnover.summary.cogs)} tone="amber" />
              <KpiCard
                label="Stock Turnover"
                value={turnover.summary.turnoverRatio === null ? '—' : String(turnover.summary.turnoverRatio)}
                tone="white"
                hint={`Stock value ${money(turnover.summary.stockValue)}`}
              />
            </div>

            <ReportTable
              headers={[
                { label: 'Month' },
                { label: 'Sales', align: 'right' },
                { label: 'Purchases', align: 'right' },
                { label: 'Difference', align: 'right' },
                { label: 'Ratio', align: 'right' },
              ]}
              isEmpty={turnover.data.length === 0}
              empty="No purchase or sales activity in this period."
            >
              {turnover.data.map((r) => (
                <tr key={r.month} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-white">{r.month}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{money(r.salesValue)}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{money(r.purchaseValue)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${r.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {money(r.difference)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">{r.ratio === null ? '—' : r.ratio}</td>
                </tr>
              ))}
            </ReportTable>
          </>
        )}
      </div>
    </ReportShell>
  );
}
