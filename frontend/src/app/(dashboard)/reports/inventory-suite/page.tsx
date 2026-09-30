'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  BookOpen,
  ArrowLeftRight,
  Hourglass,
  TrendingUp,
  Building2,
  ShoppingCart,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ReportShell, ReportTable, money } from '../../../../components/reports/ReportShell';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { useReportData, REPORT_API } from '../../../../components/reports/useReportData';
import { Tabs } from '../../../../components/ui/Tabs';
import { Badge } from '../../../../components/ui/Badge';

type SuiteTab = 'valuation' | 'ledger' | 'movements' | 'expiry' | 'purchase-sales' | 'supplier-prices' | 'reorder';

const TABS: { key: SuiteTab; label: string; icon: React.ReactNode; exportType: string; dated: boolean }[] = [
  { key: 'valuation', label: 'Valuation', icon: <Boxes className="w-3.5 h-3.5" />, exportType: 'inventory', dated: false },
  { key: 'ledger', label: 'Stock Ledger', icon: <BookOpen className="w-3.5 h-3.5" />, exportType: 'stock-ledger', dated: true },
  { key: 'movements', label: 'Movement Summary', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, exportType: 'stock-movement-summary', dated: true },
  { key: 'expiry', label: 'Expiry', icon: <Hourglass className="w-3.5 h-3.5" />, exportType: 'expiry', dated: false },
  { key: 'purchase-sales', label: 'Purchase vs Sales', icon: <TrendingUp className="w-3.5 h-3.5" />, exportType: 'purchase-vs-sales', dated: true },
  { key: 'supplier-prices', label: 'Supplier Prices', icon: <Building2 className="w-3.5 h-3.5" />, exportType: 'supplier-price-comparison', dated: false },
  { key: 'reorder', label: 'Auto Reorder', icon: <ShoppingCart className="w-3.5 h-3.5" />, exportType: 'auto-reorder', dated: false },
];

interface ProductOption {
  id: string;
  name: string;
  sku?: string;
}

export default function InventorySuitePage() {
  const [activeTab, setActiveTab] = useState<SuiteTab>('valuation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);

  // Stock ledger needs a product and its variant
  const [productSearch, setProductSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [variants, setVariants] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedVariant, setSelectedVariant] = useState('');

  const meta = TABS.find((t) => t.key === activeTab)!;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(productSearch), 350);
    return () => clearTimeout(t);
  }, [productSearch]);

  useEffect(() => {
    if (debounced.length < 2) {
      setProducts([]);
      return;
    }
    fetch(`${REPORT_API}/products?search=${encodeURIComponent(debounced)}&limit=10`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data?.data || j?.data || [];
        setProducts(
          (Array.isArray(rows) ? rows : []).map((p: any) => ({
            id: p.id || p._id,
            name: p.name,
            sku: p.primarySku || p.sku,
          }))
        );
      })
      .catch(() => setProducts([]));
  }, [debounced]);

  useEffect(() => {
    if (!selectedProduct) {
      setVariants([]);
      return;
    }
    fetch(`${REPORT_API}/products/${selectedProduct.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const vs = j?.data?.variants || [];
        setVariants(vs.map((v: any) => ({ id: v._id || v.id, label: `${v.attributeName} · ${v.sku}` })));
        setSelectedVariant(vs[0]?._id || vs[0]?.id || '');
      })
      .catch(() => setVariants([]));
  }, [selectedProduct]);

  // Endpoint per tab — the ledger needs a product/Variant, expiry needs days
  const endpoint = useMemo(() => {
    if (activeTab === 'valuation') return '/reports/inventory-valuation';
    if (activeTab === 'movements') return '/reports/stock-movement-summary';
    if (activeTab === 'purchase-sales') return '/reports/purchase-vs-sales';
    if (activeTab === 'supplier-prices') return '/reports/supplier-price-comparison';
    if (activeTab === 'reorder') return '/reports/auto-reorder';
    if (activeTab === 'expiry') return `/reports/expiry?days=${expiryDays}`;
    if (activeTab === 'ledger') {
      if (!selectedProduct) return '';
      const qs = new URLSearchParams({ productId: selectedProduct.id });
      if (selectedVariant) qs.set('variantId', selectedVariant);
      return `/reports/stock-ledger?${qs.toString()}`;
    }
    return '';
  }, [activeTab, expiryDays, selectedProduct, selectedVariant]);

  const needsLedgerPicker = activeTab === 'ledger' && !selectedProduct;
  const { data, loading, error, reload } = useReportData<any>(
    needsLedgerPicker ? '' : endpoint,
    startDate,
    endDate,
    meta.dated
  );

  return (
    <div className="space-y-6">
      <ReportShell
        title="Inventory Suite"
        subtitle="Valuation, ledger, movements, expiry, supplier prices and reorder planning"
        icon={Boxes}
        exportType={meta.exportType}
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onRefresh={reload}
        loading={needsLedgerPicker ? false : loading}
        error={needsLedgerPicker ? '' : error}
        showDateFilter={meta.dated}
        extraQuery={{
          ...(activeTab === 'expiry' ? { days: String(expiryDays) } : {}),
          ...(activeTab === 'ledger' && selectedProduct ? { productId: selectedProduct.id } : {}),
          ...(activeTab === 'ledger' && selectedVariant ? { variantId: selectedVariant } : {}),
        }}
      >
        {activeTab === 'valuation' && <ValuationTab data={data} />}
        {activeTab === 'movements' && <MovementsTab data={data} />}
        {activeTab === 'expiry' && (
          <ExpiryTab data={data} days={expiryDays} onDaysChange={setExpiryDays} />
        )}
        {activeTab === 'purchase-sales' && <PurchaseVsSalesTab data={data} />}
        {activeTab === 'supplier-prices' && <SupplierPricesTab data={data} />}
        {activeTab === 'reorder' && <ReorderTab data={data} />}
        {activeTab === 'ledger' && (
          <LedgerTab
            data={data}
            productSearch={productSearch}
            onSearch={setProductSearch}
            products={products}
            onPick={(p) => {
              setSelectedProduct(p);
              setProductSearch('');
            }}
            selectedProduct={selectedProduct}
            variants={variants}
            selectedVariant={selectedVariant}
            onVariant={setSelectedVariant}
            onClear={() => {
              setSelectedProduct(null);
              setVariants([]);
              setSelectedVariant('');
            }}
          />
        )}
      </ReportShell>

      {/* Tabs sit under the shell header so the export buttons always match the tab */}
      <div className="-mt-2">
        <Tabs
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as SuiteTab)}
          variant="pills"
        />
      </div>
    </div>
  );
}

/* ────────────────────────────── tabs ────────────────────────────── */

function ValuationTab({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Variants" value={String(data.summary?.totalVariants ?? 0)} tone="indigo" />
        <KpiCard label="Stock Quantity" value={String(data.summary?.totalStockQty ?? 0)} tone="white" />
        <KpiCard label="Asset Value" value={money(data.summary?.totalValuation)} tone="emerald" />
      </div>
      <ReportTable
        headers={[
          { label: 'Product' },
          { label: 'Category' },
          { label: 'Variant' },
          { label: 'SKU' },
          { label: 'Stock', align: 'right' },
          { label: 'Cost', align: 'right' },
          { label: 'Asset Value', align: 'right' },
          { label: 'Status', align: 'center' },
        ]}
        isEmpty={!data.data?.length}
      >
        {data.data?.map((r: any, i: number) => (
          <tr key={i} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-white font-medium">{r.productName}</td>
            <td className="py-2.5 px-4 text-slate-400">{r.categoryName}</td>
            <td className="py-2.5 px-4 text-slate-300">{r.variantName}</td>
            <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{r.sku}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.currentStock}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{money(r.costPrice)}</td>
            <td className="py-2.5 px-4 text-right text-emerald-400 font-semibold">{money(r.assetValue)}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={r.status === 'LOW_STOCK' ? 'warning' : 'success'}>
                {r.status === 'LOW_STOCK' ? 'Low' : 'Healthy'}
              </Badge>
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function MovementsTab({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Movements" value={String(data.summary?.totalEvents ?? 0)} tone="indigo" />
        <KpiCard label="Total In" value={String(data.summary?.totalInQty ?? 0)} tone="emerald" />
        <KpiCard label="Total Out" value={String(data.summary?.totalOutQty ?? 0)} tone="rose" />
        <KpiCard label="Movement Value" value={money(data.summary?.totalStockValue)} tone="white" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">By type & source</h3>
          <ReportTable
            headers={[
              { label: 'Type' },
              { label: 'Source' },
              { label: 'Events', align: 'right' },
              { label: 'Qty', align: 'right' },
              { label: 'Value', align: 'right' },
            ]}
            isEmpty={!data.byType?.length}
          >
            {data.byType?.map((r: any, i: number) => (
              <tr key={i} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4">
                  <Badge variant={r.type === 'IN' ? 'success' : r.type === 'OUT' ? 'danger' : 'neutral'}>{r.type}</Badge>
                </td>
                <td className="py-2.5 px-4 text-slate-300">{r.referenceType}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{r.events}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{r.quantity}</td>
                <td className="py-2.5 px-4 text-right text-slate-400">{money(r.value)}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Top movers</h3>
          <ReportTable
            headers={[
              { label: 'Product' },
              { label: 'In', align: 'right' },
              { label: 'Out', align: 'right' },
              { label: 'Net', align: 'right' },
            ]}
            isEmpty={!data.topMovers?.length}
          >
            {data.topMovers?.map((r: any, i: number) => (
              <tr key={i} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 text-white">{r.productName || '—'}</td>
                <td className="py-2.5 px-4 text-right text-emerald-400">{r.inQty}</td>
                <td className="py-2.5 px-4 text-right text-rose-400">{r.outQty}</td>
                <td className="py-2.5 px-4 text-right text-slate-200 font-semibold">{r.netQty}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
      </div>
    </div>
  );
}

function ExpiryTab({ data, days, onDaysChange }: { data: any; days: number; onDaysChange: (d: number) => void }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Look ahead</span>
        {[15, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => onDaysChange(d)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              days === d
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {d} days
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Expired Batches" value={String(data.summary?.expiredBatches ?? 0)} tone="rose" />
        <KpiCard label="Expiring Soon" value={String(data.summary?.expiringBatches ?? 0)} tone="amber" />
        <KpiCard label="Expired Value" value={money(data.summary?.expiredValue)} tone="rose" />
        <KpiCard label="At-risk Value" value={money(data.summary?.atRiskValue)} tone="amber" />
      </div>
      <ReportTable
        headers={[
          { label: 'Product' },
          { label: 'Batch' },
          { label: 'Expiry', align: 'center' },
          { label: 'Days Left', align: 'right' },
          { label: 'Qty', align: 'right' },
          { label: 'Value', align: 'right' },
          { label: 'Status', align: 'center' },
        ]}
        isEmpty={!data.data?.length}
        empty="No batches expiring in this window."
      >
        {data.data?.map((r: any, i: number) => (
          <tr key={i} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-white">
              {r.productName}
              <span className="block text-[10px] text-slate-500">{r.variantName}</span>
            </td>
            <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{r.batchNo || '—'}</td>
            <td className="py-2.5 px-4 text-center text-slate-300">
              {new Date(r.expiryDate).toLocaleDateString()}
            </td>
            <td className="py-2.5 px-4 text-right font-semibold text-slate-200">{r.daysLeft}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.quantity}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{money(r.value)}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={r.status === 'EXPIRED' ? 'danger' : 'warning'}>
                {r.status === 'EXPIRED' ? 'Expired' : 'Soon'}
              </Badge>
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function PurchaseVsSalesTab({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Sales" value={money(data.summary?.totalSales)} tone="emerald" />
        <KpiCard label="Purchases" value={money(data.summary?.totalPurchases)} tone="indigo" />
        <KpiCard label="COGS" value={money(data.summary?.cogs)} tone="amber" />
        <KpiCard label="Closing Stock" value={money(data.summary?.stockValue)} tone="white" />
        <KpiCard
          label="Turnover Ratio"
          value={data.summary?.turnoverRatio === null ? '—' : String(data.summary?.turnoverRatio)}
          tone="purple"
          hint="COGS ÷ average stock"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Purchases vs sales by month</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => money(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="salesValue" name="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchaseValue" name="Purchases" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ReportTable
        headers={[
          { label: 'Month' },
          { label: 'Sales', align: 'right' },
          { label: 'Purchases', align: 'right' },
          { label: 'Difference', align: 'right' },
          { label: 'Ratio', align: 'right' },
          { label: 'Invoices', align: 'right' },
          { label: 'Orders', align: 'right' },
        ]}
        isEmpty={!data.data?.length}
      >
        {data.data?.map((r: any) => (
          <tr key={r.month} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-white font-medium">{r.month}</td>
            <td className="py-2.5 px-4 text-right text-emerald-400">{money(r.salesValue)}</td>
            <td className="py-2.5 px-4 text-right text-indigo-400">{money(r.purchaseValue)}</td>
            <td className={`py-2.5 px-4 text-right font-semibold ${r.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {money(r.difference)}
            </td>
            <td className="py-2.5 px-4 text-right text-slate-400">{r.ratio ?? '—'}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.invoices}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.orders}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function SupplierPricesTab({ data }: { data: any }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Products Compared" value={String(data.summary?.products ?? 0)} tone="indigo" />
        <KpiCard label="Multi-supplier" value={String(data.summary?.multiSupplierProducts ?? 0)} tone="white" />
        <KpiCard
          label="Average Price Spread"
          value={`${data.summary?.avgSpreadPercent ?? 0}%`}
          tone="amber"
          hint="Savings if you always buy from the cheapest"
        />
      </div>
      <ReportTable
        headers={[
          { label: 'Product' },
          { label: 'SKU' },
          { label: 'Best Supplier' },
          { label: 'Cheapest', align: 'right' },
          { label: 'Dearest', align: 'right' },
          { label: 'Spread', align: 'right' },
          { label: 'Suppliers', align: 'center' },
        ]}
        isEmpty={!data.data?.length}
      >
        {data.data?.map((r: any) => (
          <React.Fragment key={String(r.productId)}>
            <tr
              className="hover:bg-slate-800/40 cursor-pointer"
              onClick={() => setOpen(open === String(r.productId) ? null : String(r.productId))}
            >
              <td className="py-2.5 px-4 text-white font-medium">{r.productName}</td>
              <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{r.sku}</td>
              <td className="py-2.5 px-4 text-slate-300">{r.bestSupplier || '—'}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400 font-semibold">{money(r.cheapestPrice)}</td>
              <td className="py-2.5 px-4 text-right text-slate-400">{money(r.dearestPrice)}</td>
              <td className="py-2.5 px-4 text-right text-amber-400">{r.spreadPercent}%</td>
              <td className="py-2.5 px-4 text-center text-slate-400">{r.supplierCount}</td>
            </tr>
            {open === String(r.productId) &&
              r.suppliers?.map((s: any, i: number) => (
                <tr key={i} className="bg-slate-950/40">
                  <td className="py-2 px-4 pl-10 text-slate-400" colSpan={2}>
                    {s.supplierName || '—'}
                  </td>
                  <td className="py-2 px-4 text-slate-500">
                    {s.isCheapest ? <Badge variant="success">Cheapest</Badge> : ''}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-300">{money(s.lastPrice)}</td>
                  <td className="py-2 px-4 text-right text-slate-500">
                    {money(s.minPrice)} – {money(s.maxPrice)}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-500">{s.totalQty} qty</td>
                  <td className="py-2 px-4 text-center text-slate-500">{s.orders} order(s)</td>
                </tr>
              ))}
          </React.Fragment>
        ))}
      </ReportTable>
    </div>
  );
}

function ReorderTab({ data }: { data: any }) {
  if (!data) return null;
  const tone = (p: string) =>
    p === 'CRITICAL' ? 'danger' : p === 'HIGH' ? 'warning' : p === 'MEDIUM' ? 'info' : 'neutral';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KpiCard label="Items To Order" value={String(data.summary?.items ?? 0)} tone="indigo" />
        <KpiCard label="Critical" value={String(data.summary?.critical ?? 0)} tone="rose" />
        <KpiCard label="Estimated Cost" value={money(data.summary?.totalEstimatedCost)} tone="emerald" />
        <KpiCard
          label="Velocity Window"
          value={`${data.summary?.velocityWindowDays ?? 30} days`}
          tone="white"
          hint={`Lead time ${data.summary?.leadTimeDays}d + safety ${data.summary?.safetyDays}d`}
        />
      </div>
      <ReportTable
        headers={[
          { label: 'Product' },
          { label: 'SKU' },
          { label: 'Stock', align: 'right' },
          { label: 'Daily Sales', align: 'right' },
          { label: 'Days Left', align: 'right' },
          { label: 'Suggested', align: 'right' },
          { label: 'Est. Cost', align: 'right' },
          { label: 'Supplier' },
          { label: 'Priority', align: 'center' },
        ]}
        isEmpty={!data.data?.length}
        empty="Everything is comfortably in stock."
      >
        {data.data?.map((r: any, i: number) => (
          <tr key={i} className="hover:bg-slate-800/40">
            <td className="py-2.5 px-4 text-white">
              {r.productName}
              <span className="block text-[10px] text-slate-500">{r.variantName}</span>
            </td>
            <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{r.sku}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{r.currentStock}</td>
            <td className="py-2.5 px-4 text-right text-slate-400">{r.avgDailySales}</td>
            <td className="py-2.5 px-4 text-right text-amber-400 font-semibold">{r.daysLeft ?? '—'}</td>
            <td className="py-2.5 px-4 text-right text-white font-bold">{r.suggestedQty}</td>
            <td className="py-2.5 px-4 text-right text-slate-300">{money(r.estimatedCost)}</td>
            <td className="py-2.5 px-4 text-slate-400">{r.supplierName || '—'}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={tone(r.priority) as any}>{r.priority}</Badge>
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function LedgerTab({
  data,
  productSearch,
  onSearch,
  products,
  onPick,
  selectedProduct,
  variants,
  selectedVariant,
  onVariant,
  onClear,
}: {
  data: any;
  productSearch: string;
  onSearch: (v: string) => void;
  products: ProductOption[];
  onPick: (p: ProductOption) => void;
  selectedProduct: ProductOption | null;
  variants: Array<{ id: string; label: string }>;
  selectedVariant: string;
  onVariant: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <label className="text-xs text-slate-400">Product</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                value={productSearch}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search by name, SKU or barcode…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {products.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPick(p)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-slate-500">{p.sku || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {variants.length > 1 && (
            <div className="min-w-[220px]">
              <label className="text-xs text-slate-400">Variant</label>
              <select
                value={selectedVariant}
                onChange={(e) => onVariant(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedProduct && (
            <button onClick={onClear} className="text-xs text-slate-400 hover:text-rose-400 pb-2.5">
              Clear
            </button>
          )}
        </div>
        {selectedProduct && (
          <p className="text-xs text-slate-400">
            Showing the ledger for <span className="text-white font-medium">{selectedProduct.name}</span>
          </p>
        )}
      </div>

      {!selectedProduct ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-300">Pick a product to see every stock movement</p>
          <p className="text-xs text-slate-500 mt-1">
            Each row shows the movement, its source (sale, purchase, transfer…) and the running balance.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Movements" value={String(data?.summary?.movements ?? 0)} tone="indigo" />
            <KpiCard label="Total In" value={String(data?.summary?.totalIn ?? 0)} tone="emerald" />
            <KpiCard label="Total Out" value={String(data?.summary?.totalOut ?? 0)} tone="rose" />
            <KpiCard label="Closing Balance" value={String(data?.summary?.closingBalance ?? 0)} tone="white" />
          </div>
          <ReportTable
            headers={[
              { label: 'Date', align: 'center' },
              { label: 'Type' },
              { label: 'Source' },
              { label: 'Qty', align: 'right' },
              { label: 'Balance', align: 'right' },
              { label: 'Value', align: 'right' },
              { label: 'Reason' },
              { label: 'By' },
            ]}
            isEmpty={!data?.data?.length}
          >
            {data?.data?.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 text-center text-slate-400">
                  {new Date(r.date).toLocaleDateString()}
                </td>
                <td className="py-2.5 px-4">
                  <Badge variant={r.type === 'IN' || r.type === 'RETURN' ? 'success' : r.type === 'OUT' ? 'danger' : 'neutral'}>
                    {r.type}
                  </Badge>
                </td>
                <td className="py-2.5 px-4 text-slate-400">{r.referenceType}</td>
                <td className="py-2.5 px-4 text-right text-slate-300">{r.quantity}</td>
                <td className="py-2.5 px-4 text-right text-white font-semibold">{r.balance}</td>
                <td className="py-2.5 px-4 text-right text-slate-400">{money(r.value)}</td>
                <td className="py-2.5 px-4 text-slate-500 truncate max-w-[220px]">{r.reason || '—'}</td>
                <td className="py-2.5 px-4 text-slate-400">{r.user || '—'}</td>
              </tr>
            ))}
          </ReportTable>
        </>
      )}
    </div>
  );
}
