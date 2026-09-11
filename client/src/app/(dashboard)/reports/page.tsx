'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  Package,
  Boxes,
  FileSpreadsheet,
  FileText,
  Users,
  Building,
  RefreshCw,
  ArrowRight,
  DollarSign,
  PieChart,
  FileDown,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

type ReportTab = 'SALES' | 'PRODUCTS' | 'INVENTORY' | 'PNL' | 'DUES' | 'PAYABLES';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('SALES');
  const [loading, setLoading] = useState(true);

  // Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Report Data States
  const [salesReport, setSalesReport] = useState<any>(null);
  const [productsReport, setProductsReport] = useState<any[]>([]);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [pnlReport, setPnlReport] = useState<any>(null);
  const [duesReport, setDuesReport] = useState<any>(null);
  const [payablesReport, setPayablesReport] = useState<any>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    }).toString();

    try {
      if (activeTab === 'SALES') {
        const res = await fetch(`${API}/reports/sales?${query}`, { headers: authHeader() });
        const j = await res.json();
        if (j.success) setSalesReport(j.data);
      } else if (activeTab === 'PRODUCTS') {
        const res = await fetch(`${API}/reports/products?${query}`, { headers: authHeader() });
        const j = await res.json();
        if (j.success) setProductsReport(j.data || []);
      } else if (activeTab === 'INVENTORY') {
        const res = await fetch(`${API}/reports/inventory`, { headers: authHeader() });
        const j = await res.json();
        if (j.success) setInventoryReport(j.data);
      } else if (activeTab === 'PNL') {
        const res = await fetch(`${API}/reports/pnl?${query}`, { headers: authHeader() });
        const j = await res.json();
        if (j.success) setPnlReport(j.data);
      } else if (activeTab === 'DUES') {
        const res = await fetch(`${API}/reports/dues`, { headers: authHeader() });
        const j = await res.json();
        if (j.success) setDuesReport(j.data);
      } else if (activeTab === 'PAYABLES') {
        const res = await fetch(`${API}/reports/payables`, { headers: authHeader() });
        const j = await res.json();
        if (j.success) setPayablesReport(j.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const getExportType = (): string => {
    if (activeTab === 'PRODUCTS') return 'products';
    if (activeTab === 'INVENTORY') return 'inventory';
    if (activeTab === 'PNL') return 'pnl';
    if (activeTab === 'DUES') return 'dues';
    if (activeTab === 'PAYABLES') return 'payables';
    return 'sales';
  };

  const buildQuery = (): string =>
    new URLSearchParams({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    }).toString();

  const handleExportCsv = () => {
    window.open(`${API}/reports/export/${getExportType()}?${buildQuery()}`, '_blank');
  };

  const handleExportPdf = () => {
    window.open(`${API}/reports/export-pdf/${getExportType()}?${buildQuery()}`, '_blank');
  };

  const handleExportExcel = () => {
    window.open(`${API}/reports/export-excel/${getExportType()}?${buildQuery()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Business Intelligence & Reports</h1>
            <p className="text-sm text-slate-400">
              Audit sales volume, inventory asset valuation, P&L profit margins & credit aging
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 print:hidden">
          <button
            onClick={fetchReport}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-600/20"
            title="Download PDF Report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
            title="Download Excel Workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
            title="Download CSV File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Tab Switcher Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        {/* Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-bold scrollbar-none pb-1 lg:pb-0">
          {[
            { id: 'SALES', label: 'Sales Summary', icon: TrendingUp },
            { id: 'PRODUCTS', label: 'Product Performance', icon: Package },
            { id: 'INVENTORY', label: 'Stock Valuation', icon: Boxes },
            { id: 'PNL', label: 'Profit & Loss (P&L)', icon: PieChart },
            { id: 'DUES', label: 'Customer Dues', icon: Users },
            { id: 'PAYABLES', label: 'Supplier Payables', icon: Building },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ReportTab)}
                className={`px-3 py-2 rounded-xl transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Filters */}
        <div className="flex items-center space-x-2 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
            title="Start Date"
          />
          <span className="text-slate-500 font-bold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
            title="End Date"
          />
        </div>
      </div>

      {/* Tab 1: Sales Summary Report */}
      {activeTab === 'SALES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Total Net Revenue</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                ৳{salesReport?.summary.totalNet?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Invoices Finalized</div>
              <div className="text-2xl font-black text-white mt-1">
                {salesReport?.summary.totalOrders || 0}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Total VAT Collected</div>
              <div className="text-2xl font-black text-indigo-400 mt-1">
                ৳{salesReport?.summary.totalTax?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Total Discounts</div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                ৳{salesReport?.summary.totalDiscount?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Gross</th>
                    <th className="py-3 px-4 text-right">Tax</th>
                    <th className="py-3 px-4 text-right">Discount</th>
                    <th className="py-3 px-4 text-right font-bold text-white">Net Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {salesReport?.data?.map((s: any) => (
                    <tr key={s._id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{s.invoiceNo}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        ৳{s.subtotal?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        ৳{s.totalTax?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        ৳{s.discountAmount?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">
                        ৳{s.totalAmount?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        ৳{s.paidAmount?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {s.dueAmount > 0 ? (
                          <span className="text-rose-400">৳{s.dueAmount?.toFixed(2)}</span>
                        ) : (
                          '৳0.00'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Product Performance Report */}
      {activeTab === 'PRODUCTS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                  <th className="py-3 px-4">Item & Variant</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Gross Revenue</th>
                  <th className="py-3 px-4 text-right">Cost (COGS)</th>
                  <th className="py-3 px-4 text-right font-bold text-emerald-400">
                    Gross Margin Contribution
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {productsReport.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No product sales recorded in this period.
                    </td>
                  </tr>
                ) : (
                  productsReport.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{p.productName}</div>
                        <div className="text-[11px] text-slate-400">{p.variantName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{p.sku}</td>
                      <td className="py-3 px-4 text-center font-bold text-white">{p.unitsSold}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-200">
                        ৳{p.revenue?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        ৳{p.cost?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">
                        ৳{p.grossProfit?.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Valuation Report */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Total Asset Valuation</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                ৳{inventoryReport?.summary.totalValuation?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Total Stock Qty On-Hand</div>
              <div className="text-2xl font-black text-white mt-1">
                {inventoryReport?.summary.totalStockQty || 0} units
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-xs text-slate-400">Tracked SKUs</div>
              <div className="text-2xl font-black text-purple-400 mt-1">
                {inventoryReport?.summary.totalVariants || 0}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Cost (WAC)</th>
                    <th className="py-3 px-4 text-right">Retail</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-right font-bold text-white">Asset Valuation</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inventoryReport?.data?.map((i: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{i.productName}</div>
                        <div className="text-slate-400">{i.variantName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{i.sku}</td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        ৳{i.costPrice?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        ৳{i.retailPrice?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-white">
                        {i.currentStock} {i.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">
                        ৳{i.assetValue?.toFixed(2)}
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
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Profit & Loss (P&L) Statement */}
      {activeTab === 'PNL' && pnlReport && (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center border-b border-slate-800 pb-4">
            <h2 className="text-xl font-black text-white tracking-tight">
              STATEMENT OF PROFIT & LOSS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Period: {pnlReport.period.startDate} to {pnlReport.period.endDate}
            </p>
          </div>

          <div className="space-y-4 text-sm font-mono">
            {/* Revenue & COGS */}
            <div className="space-y-2 border-b border-slate-800 pb-4">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">1. Gross Net Sales Revenue</span>
                <span className="text-emerald-400 font-bold">
                  +৳{pnlReport.revenue.totalSales.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-400 text-xs">
                <span>&nbsp;&nbsp;Less: Cost of Goods Sold (COGS)</span>
                <span>-৳{pnlReport.revenue.cogs.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 font-bold text-base border-t border-slate-800 text-white">
                <span>(=) Gross Trading Margin</span>
                <span className="text-emerald-400">
                  ৳{pnlReport.revenue.grossProfit.toFixed(2)} (
                  {pnlReport.revenue.grossMarginPercentage.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Operating Expenses & Wastage */}
            <div className="space-y-2 border-b border-slate-800 pb-4 text-xs">
              <div className="text-slate-400 uppercase font-bold text-[11px]">
                2. Operating Expenses & Spoilage
              </div>
              {Object.entries(pnlReport.expenses.breakdown || {}).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between items-center text-slate-300">
                  <span>&nbsp;&nbsp;{cat}</span>
                  <span className="text-rose-400">-৳{(amt as number).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 font-bold border-t border-slate-800 text-slate-200">
                <span>Total Operating Overheads</span>
                <span className="text-rose-400">
                  -৳{pnlReport.expenses.totalExpenses.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className="p-4 bg-slate-950 rounded-2xl flex items-center justify-between font-sans">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold">Net Operating Profit</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Margin: {pnlReport.netProfitMargin}%
                </div>
              </div>
              <div
                className={`text-2xl font-black ${
                  pnlReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ৳{pnlReport.netProfit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Customer Dues Report */}
      {activeTab === 'DUES' && duesReport && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Total Customer Receivables</div>
              <div className="text-2xl font-black text-rose-400 mt-1">
                ৳{duesReport.summary.totalOutstandingDue?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-400">
              {duesReport.summary.customersWithDue} customers with active balance
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right font-bold text-rose-400">Current Due</th>
                  <th className="py-3 px-4 text-center">Credit Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {duesReport.data?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                    <td className="py-3 px-4 text-slate-300">{c.phone}</td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      ৳{c.creditLimit?.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-400">
                      ৳{c.currentDueBalance?.toFixed(2)}
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Supplier Payables Report */}
      {activeTab === 'PAYABLES' && payablesReport && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Total Vendor Accounts Payable</div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                ৳{payablesReport.summary.totalOutstandingPayable?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-400">
              {payablesReport.summary.suppliersWithPayable} vendors with payable balance
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                  <th className="py-3 px-4">Supplier Company</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right font-bold text-amber-400">Payable Debt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {payablesReport.data?.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{s.companyName}</td>
                    <td className="py-3 px-4 text-slate-300">{s.contactPerson}</td>
                    <td className="py-3 px-4 text-slate-400">{s.phone}</td>
                    <td className="py-3 px-4 text-right font-black text-amber-400">
                      ৳{s.currentPayableBalance?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
