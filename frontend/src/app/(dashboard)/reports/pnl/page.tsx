'use client';

import React, { useState } from 'react';
import { PieChart } from 'lucide-react';
import { ReportShell, money } from '../../../../components/reports/ReportShell';
import { useReportData } from '../../../../components/reports/useReportData';

interface PnlReport {
  period: { startDate: string; endDate: string };
  revenue: {
    totalSales: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercentage: number;
  };
  expenses: {
    operatingExpenses: number;
    wastageLoss: number;
    totalExpenses: number;
    breakdown: Record<string, number>;
  };
  netProfit: number;
  netProfitMargin: number;
}

export default function PnlReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data, loading, error, reload } = useReportData<PnlReport>(
    '/reports/pnl',
    startDate,
    endDate
  );

  const breakdown = Object.entries(data?.expenses.breakdown || {});

  return (
    <ReportShell
      title="Profit & Loss Statement"
      subtitle="Gross trading margin less operating overheads and inventory spoilage"
      icon={PieChart}
      exportType="pnl"
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
      {data && (
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center border-b border-slate-800 pb-4">
            <h2 className="text-xl font-black text-white tracking-tight">
              STATEMENT OF PROFIT &amp; LOSS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Period: {data.period.startDate} to {data.period.endDate}
            </p>
          </div>

          <div className="space-y-4 text-sm font-mono">
            <div className="space-y-2 border-b border-slate-800 pb-4">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">1. Gross Net Sales Revenue</span>
                <span className="text-emerald-400 font-bold">
                  +{money(data.revenue.totalSales)}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-400 text-xs">
                <span>&nbsp;&nbsp;Less: Cost of Goods Sold (COGS)</span>
                <span>-{money(data.revenue.cogs)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 font-bold text-base border-t border-slate-800 text-white">
                <span>(=) Gross Trading Margin</span>
                <span className="text-emerald-400">
                  {money(data.revenue.grossProfit)} ({data.revenue.grossMarginPercentage.toFixed(1)}
                  %)
                </span>
              </div>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-4 text-xs">
              <div className="text-slate-400 uppercase font-bold text-[11px]">
                2. Operating Expenses &amp; Spoilage
              </div>
              {breakdown.length === 0 ? (
                <div className="text-slate-500">&nbsp;&nbsp;No expenses recorded in this period.</div>
              ) : (
                breakdown.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center text-slate-300">
                    <span>&nbsp;&nbsp;{cat}</span>
                    <span className="text-rose-400">-{money(amt)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between items-center pt-2 font-bold border-t border-slate-800 text-slate-200">
                <span>Total Operating Overheads</span>
                <span className="text-rose-400">-{money(data.expenses.totalExpenses)}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl flex items-center justify-between font-sans">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold">
                  Net Operating Profit
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Margin: {data.netProfitMargin.toFixed(2)}%
                </div>
              </div>
              <div
                className={`text-2xl font-black ${
                  data.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {money(data.netProfit)}
              </div>
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
