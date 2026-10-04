'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScanBarcode,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Tag,
  Building2,
} from 'lucide-react';
import { ReportShell } from '../../../../components/reports/ReportShell';
import { REPORT_API } from '../../../../components/reports/useReportData';
import { ChartCard, TrendChart } from '../../../../components/reports/charts';

interface Movement {
  date: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'WASTAGE';
  qtyIn: number;
  qtyOut: number;
  reference: string;
  balanceAfter: number;
}

interface BarcodeReport {
  product: {
    name: string;
    sku: string;
    barcode: string | null;
    variantName: string;
    category: string;
    brand: string;
    unit: string;
    currentStock: number;
    costPrice: number;
    retailPrice: number;
    wholesalePrice: number;
  };
  movements: Movement[];
  summary: {
    totalPurchased: number;
    totalSold: number;
    totalAdjusted: number;
    openingStock: number;
    closingStock: number;
    stockValue: number;
  };
}

const money = (v: number) => `৳${(v ?? 0).toFixed(2)}`;

/** Movement colours: purchase=green, sale=red, adjustment=blue, return=orange */
const TYPE_STYLE: Record<string, string> = {
  IN: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  OUT: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  ADJUSTMENT: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  RETURN: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  WASTAGE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default function BarcodeTrackerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [report, setReport] = useState<BarcodeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // USB barcode scanners type then hit Enter — the input is always focused
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lookup = useCallback(
    async (value: string) => {
      const barcode = value.trim();
      if (!barcode) return;
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({
          barcode,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        }).toString();
        const res = await fetch(`${REPORT_API}/reports/barcode-wise?${qs}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (json.success) {
          setReport(json.data);
        } else {
          setReport(null);
          setError(json.error?.message || 'No product found for that code');
        }
      } catch (e: any) {
        setError(e?.message || 'Lookup failed');
      } finally {
        setLoading(false);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    },
    [startDate, endDate]
  );

  return (
    <ReportShell
      title="Barcode Tracker"
      subtitle="Scan or type a barcode / SKU to see the full stock movement history"
      icon={ScanBarcode}
      exportType="barcode-wise"
      startDate={startDate}
      endDate={endDate}
      onDateChange={(s, e) => {
        setStartDate(s);
        setEndDate(e);
      }}
      onRefresh={() => lookup(code)}
      loading={loading}
      error=""
      extraQuery={code.trim() ? { barcode: code.trim() } : undefined}
    >
      <div className="space-y-4">
        {/* Scanner input */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Barcode / SKU
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lookup(code);
                }}
                placeholder="Scan with the barcode reader or type the code and press Enter…"
                className="w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
            </div>
            <button
              onClick={() => lookup(code)}
              disabled={loading || !code.trim()}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              {loading ? 'Searching…' : 'Track'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            The box stays focused — scanning consecutive items needs no clicking.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {!report && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
            <ScanBarcode className="w-12 h-12 text-slate-700" />
            <p className="text-sm">Scan a barcode to begin the stock trace.</p>
          </div>
        )}

        {report && (
          <>
            {/* Product info card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">{report.product.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {report.product.variantName} · SKU {report.product.sku}
                    {report.product.barcode ? ` · ${report.product.barcode}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                      <Package className="w-3 h-3" /> {report.product.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                      <Building2 className="w-3 h-3" /> {report.product.brand}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                      <Tag className="w-3 h-3" /> Unit: {report.product.unit}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  {[
                    { label: 'In Stock', value: `${report.product.currentStock}`, tone: 'text-white' },
                    { label: 'Cost', value: money(report.product.costPrice), tone: 'text-slate-300' },
                    { label: 'Retail', value: money(report.product.retailPrice), tone: 'text-emerald-400' },
                    { label: 'Wholesale', value: money(report.product.wholesalePrice), tone: 'text-indigo-400' },
                  ].map((k) => (
                    <div key={k.label} className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 min-w-[92px]">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</p>
                      <p className={`text-sm font-bold ${k.tone}`}>{k.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Movement totals */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-800">
                {[
                  { label: 'Opening Stock', value: report.summary.openingStock, tone: 'text-slate-200' },
                  { label: 'Purchased', value: report.summary.totalPurchased, tone: 'text-emerald-400' },
                  { label: 'Sold', value: report.summary.totalSold, tone: 'text-rose-400' },
                  { label: 'Adjusted', value: report.summary.totalAdjusted, tone: 'text-blue-400' },
                  { label: 'Closing Stock', value: report.summary.closingStock, tone: 'text-white' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                    <p className={`text-base font-black ${s.tone}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <ChartCard
              title="Stock balance over time"
              subtitle="Running balance after each movement"
              height={260}
            >
              <TrendChart
                data={[...report.movements].reverse().map((m) => ({
                  date: new Date(m.date).toISOString().slice(0, 10),
                  balance: m.balanceAfter,
                }))}
                xKey="date"
                series={[{ key: 'balance', name: 'Balance', color: '#6366f1' }]}
                valueFormat={(v) => String(v)}
              />
            </ChartCard>

            {/* Movement table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Qty In</th>
                      <th className="py-3 px-4 text-right">Qty Out</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {report.movements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No stock movements in this period.
                        </td>
                      </tr>
                    ) : (
                      [...report.movements].reverse().map((m, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(m.date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${TYPE_STYLE[m.type] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                              {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                            {m.qtyIn ? (
                              <span className="inline-flex items-center gap-1"><ArrowDownRight className="w-3 h-3" />{m.qtyIn}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-rose-400">
                            {m.qtyOut ? (
                              <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{m.qtyOut}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{m.reference || '—'}</td>
                          <td className="py-3 px-4 text-right font-bold text-white">{m.balanceAfter}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </ReportShell>
  );
}
