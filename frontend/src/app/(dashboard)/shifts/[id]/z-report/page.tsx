'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Printer,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Monitor,
  Clock,
  User,
  Building,
} from 'lucide-react';

interface ZReportData {
  shift: {
    _id: string;
    terminalId: string;
    openedAt: string;
    closedAt?: string;
    openingFloat: number;
    cashSalesTotal: number;
    cashExpensesTotal: number;
    pettyCashIn: number;
    pettyCashOut: number;
    expectedCash: number;
    actualCash?: number;
    discrepancy?: number;
    status: string;
    notes?: string;
    userId?: { name: string; email: string };
  };
  salesSummary?: {
    totalInvoices: number;
    totalItemsSold: number;
    grossSales: number;
    totalDiscount: number;
    totalTax: number;
    netSales: number;
  };
  paymentBreakdown?: {
    CASH?: number;
    CARD?: number;
    BKASH?: number;
    NAGAD?: number;
    STORE_CREDIT?: number;
    CUSTOMER_DUE?: number;
  };
  returnsSummary?: {
    totalReturns: number;
    totalRefundAmount: number;
  };
}

function formatDuration(start: string, end?: string) {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((to - from) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function ZReportPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const id = params?.id as string;
  const [report, setReport] = useState<ZReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/shifts/${id}/z-report`)
      .then((res) => setReport(res.data))
      .catch((err) => toast.error('Error', err?.message || 'Failed to load Z-Report'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!report?.shift) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-100">Z-Report Not Found</h2>
        <Button variant="ghost" onClick={() => router.push('/shifts')}>
          Return to Shifts
        </Button>
      </div>
    );
  }

  const { shift, salesSummary, paymentBreakdown, returnsSummary } = report;
  const disc = shift.discrepancy ?? 0;
  const discColor = disc === 0 ? 'text-emerald-600' : disc > 0 ? 'text-amber-600' : 'text-red-600';

  const paymentMethods = [
    { label: 'Cash', key: 'CASH', value: paymentBreakdown?.CASH },
    { label: 'Card', key: 'CARD', value: paymentBreakdown?.CARD },
    { label: 'bKash', key: 'BKASH', value: paymentBreakdown?.BKASH },
    { label: 'Nagad', key: 'NAGAD', value: paymentBreakdown?.NAGAD },
    { label: 'Store Credit', key: 'STORE_CREDIT', value: paymentBreakdown?.STORE_CREDIT },
    { label: 'Customer Due', key: 'CUSTOMER_DUE', value: paymentBreakdown?.CUSTOMER_DUE },
  ].filter((pm) => (pm.value || 0) > 0);

  return (
    <div className="space-y-4 pb-12">
      {/* Action Header — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/shifts')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Shifts
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Z-Report — {shift.terminalId}</h1>
            <p className="text-xs text-slate-400">
              Shift closed {shift.closedAt ? formatDate(shift.closedAt) : 'N/A'}
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={handlePrint}
          leftIcon={<Printer className="w-4 h-4" />}
        >
          Print Z-Report
        </Button>
      </div>

      {/* ===== PRINTABLE Z-REPORT ===== */}
      <div
        ref={printRef}
        id="z-report-content"
        className="bg-white text-gray-900 print:text-black max-w-2xl mx-auto rounded-2xl print:rounded-none shadow-2xl print:shadow-none p-8 print:p-6 space-y-6 print:space-y-4"
      >
        {/* Shop Header */}
        <div className="text-center border-b-2 border-gray-300 pb-5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Building className="w-6 h-6 text-blue-600 print:text-black" />
            <h1 className="text-2xl font-extrabold tracking-tight">ShopManager POS</h1>
          </div>
          <p className="text-sm text-gray-500">Your Complete Shop Management Solution</p>
          <div className="mt-3 inline-block px-4 py-1.5 bg-gray-900 text-white print:bg-black print:text-white rounded-lg">
            <span className="text-sm font-bold uppercase tracking-widest">Z-Report / End-of-Shift Report</span>
          </div>
        </div>

        {/* Shift Info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-500 print:text-gray-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Terminal</p>
              <p className="font-bold">{shift.terminalId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500 print:text-gray-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Cashier</p>
              <p className="font-bold">{shift.userId?.name || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500 print:text-gray-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Opened At</p>
              <p className="font-semibold">{formatDate(shift.openedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500 print:text-gray-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Closed At</p>
              <p className="font-semibold">{shift.closedAt ? formatDate(shift.closedAt) : '—'}</p>
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 uppercase">Duration</p>
            <p className="font-semibold">{formatDuration(shift.openedAt, shift.closedAt)}</p>
          </div>
        </div>

        {/* Sales Summary */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">
            Sales Summary
          </h2>
          <div className="space-y-1.5 text-sm">
            <ZRow label="Total Invoices" value={String(salesSummary?.totalInvoices ?? 0)} />
            <ZRow label="Total Items Sold" value={String(salesSummary?.totalItemsSold ?? 0)} />
            <ZRow label="Gross Sales" value={formatCurrency(salesSummary?.grossSales ?? 0)} bold />
            <ZRow label="Total Discounts" value={`−${formatCurrency(salesSummary?.totalDiscount ?? 0)}`} />
            <ZRow label="Tax Collected" value={formatCurrency(salesSummary?.totalTax ?? 0)} />
            <ZRow label="Net Sales" value={formatCurrency(salesSummary?.netSales ?? 0)} bold highlight />
          </div>
        </section>

        {/* Payment Breakdown */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">
            Payment Method Breakdown
          </h2>
          {paymentMethods.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No payment data recorded.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              {paymentMethods.map((pm) => (
                <ZRow key={pm.key} label={pm.label} value={formatCurrency(pm.value || 0)} />
              ))}
            </div>
          )}
        </section>

        {/* Cash Register Reconciliation */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">
            Cash Register Reconciliation
          </h2>
          <div className="space-y-1.5 text-sm">
            <ZRow label="Opening Float" value={formatCurrency(shift.openingFloat)} />
            <ZRow label="+ Cash Sales" value={`+${formatCurrency(shift.cashSalesTotal)}`} />
            <ZRow label="+ Petty Cash In" value={`+${formatCurrency(shift.pettyCashIn)}`} />
            <ZRow label="− Cash Expenses" value={`−${formatCurrency(shift.cashExpensesTotal)}`} />
            <ZRow label="− Petty Cash Out" value={`−${formatCurrency(shift.pettyCashOut)}`} />
            <ZRow label="Expected Cash" value={formatCurrency(shift.expectedCash)} bold />
            <ZRow
              label="Actual Cash (Counted)"
              value={shift.actualCash !== undefined ? formatCurrency(shift.actualCash) : '—'}
              bold
            />
            <div className={`flex justify-between items-center py-2 px-3 rounded-lg font-bold text-sm ${
              disc === 0
                ? 'bg-green-50 text-green-700'
                : disc > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'
            }`}>
              <span className="flex items-center gap-1.5">
                {disc === 0 ? <Minus className="w-3.5 h-3.5" /> : disc > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                Discrepancy
              </span>
              <span>
                {disc >= 0 ? '+' : ''}{formatCurrency(disc)}
              </span>
            </div>
          </div>
        </section>

        {/* Returns Summary */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">
            Returns / Refunds
          </h2>
          <div className="space-y-1.5 text-sm">
            <ZRow label="Total Returns" value={String(returnsSummary?.totalReturns ?? 0)} />
            <ZRow label="Total Refund Amount" value={formatCurrency(returnsSummary?.totalRefundAmount ?? 0)} bold />
          </div>
        </section>

        {/* Shift Notes */}
        {shift.notes && (
          <section className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">
              Shift Notes
            </h2>
            <p className="text-xs text-gray-600 whitespace-pre-wrap">{shift.notes}</p>
          </section>
        )}

        {/* Footer — Signature Line */}
        <div className="pt-6 border-t-2 border-gray-300">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-b border-gray-400 h-8 mb-1" />
              <p className="text-xs text-gray-500">Cashier Signature</p>
              <p className="text-xs text-gray-400">{shift.userId?.name || ''}</p>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 h-8 mb-1" />
              <p className="text-xs text-gray-500">Manager Signature</p>
              <p className="text-xs text-gray-400">Authorized By</p>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Generated: {new Date().toLocaleString()} | ShopManager POS System
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper row component
function ZRow({
  label,
  value,
  bold = false,
  highlight = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-1 ${
        highlight ? 'bg-blue-50 px-3 rounded-lg -mx-3' : ''
      }`}
    >
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${highlight ? 'text-blue-700' : 'text-gray-700'}`}>
        {label}
      </span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-blue-800' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}
