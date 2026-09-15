'use client';

import React from 'react';
import { Printer, FileText, FileSpreadsheet, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { REPORT_API } from './useReportData';

export interface ReportShellProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  /** Export slug understood by the backend, e.g. "sales", "pnl", "purchases". */
  exportType: string;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string;
  showDateFilter?: boolean;
  children: React.ReactNode;
}

export function ReportShell({
  title,
  subtitle,
  icon: Icon,
  exportType,
  startDate,
  endDate,
  onDateChange,
  onRefresh,
  loading,
  error,
  showDateFilter = true,
  children,
}: ReportShellProps) {
  const query = new URLSearchParams({
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }).toString();

  const open = (path: string) => window.open(`${REPORT_API}${path}${query ? `?${query}` : ''}`, '_blank');

  return (
    <div className="space-y-6">
      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h1>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={() => open(`/reports/export-pdf/${exportType}`)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-600/20"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => open(`/reports/export-excel/${exportType}`)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => open(`/reports/export/${exportType}`)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Date range */}
      {showDateFilter && onDateChange && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
          <span className="text-xs font-bold text-slate-400 uppercase">Period</span>
          <div className="flex items-center space-x-2 text-xs">
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => onDateChange(e.target.value, endDate || '')}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              title="Start Date"
            />
            <span className="text-slate-500 font-bold">to</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => onDateChange(startDate || '', e.target.value)}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              title="End Date"
            />
          </div>
          <span className="text-[11px] text-slate-500">
            Leaving both empty shows the full history
          </span>
        </div>
      )}

      {/* Body */}
      {error ? (
        <div className="flex items-center gap-3 p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-sm">{error}</div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Shared table wrapper so every report table looks the same. */
export function ReportTable({
  headers,
  children,
  empty,
  isEmpty,
}: {
  headers: { label: string; align?: 'left' | 'right' | 'center'; className?: string }[];
  children: React.ReactNode;
  empty?: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`py-3 px-4 ${
                    h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : ''
                  } ${h.className || ''}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isEmpty ? (
              <tr>
                <td colSpan={headers.length} className="py-12 text-center text-slate-500">
                  {empty || 'No records found for this period.'}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Formats money the same way everywhere in the reports area. */
export function money(value: number | null | undefined): string {
  return `৳${(value ?? 0).toFixed(2)}`;
}
