'use client';

import React from 'react';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Button } from '../ui/Button';
import { FileText, FileSpreadsheet, Download, Printer, RefreshCw } from 'lucide-react';

export interface ReportToolbarProps {
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onExportCsv?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  extraFilters?: React.ReactNode;
}

export function ReportToolbar({
  startDate,
  endDate,
  onDateChange,
  onExportPdf,
  onExportExcel,
  onExportCsv,
  onPrint,
  onRefresh,
  loading,
  extraFilters,
}: ReportToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Inputs */}
        <div className="flex items-center space-x-2 text-xs">
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => onDateChange?.(e.target.value, endDate || '')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            title="Start Date"
          />
          <span className="text-slate-500 font-bold">to</span>
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => onDateChange?.(startDate || '', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            title="End Date"
          />
        </div>

        {extraFilters}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}

        {onPrint && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={onPrint}
          >
            Print
          </Button>
        )}

        {onExportPdf && (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<FileText className="w-4 h-4" />}
            onClick={onExportPdf}
          >
            PDF
          </Button>
        )}

        {onExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </button>
        )}

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        )}
      </div>
    </div>
  );
}
