'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { formatCurrency, formatDateTime } from '../../../../lib/utils';
import {
  Receipt,
  ArrowLeft,
  Printer,
  RotateCcw,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { useToast } from '../../../../components/ui/Toast';
import { ReturnModal } from '../../../../components/modals/ReturnModal';

interface SaleItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitSellingPrice: number;
  discount: number;
  lineTotal: number;
}

interface SaleDetail {
  _id: string;
  invoiceNo: string;
  createdAt: string;
  cashierId?: { _id: string; fullName: string; username: string };
  customerId?: { _id: string; name: string; phone: string; currentDueBalance: number };
  shiftId?: string;
  pricingTier: string;
  items: SaleItem[];
  subtotal: number;
  totalTax: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeReturned: number;
  dueAmount: number;
  payments: { method: string; amount: number; reference?: string }[];
  returns?: any[];
}

export default function SaleInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [showReturnModal, setShowReturnModal] = useState(false);

  // Fetch sale invoice details
  const { data: sale, isLoading, refetch, isRefetching } = useQuery<SaleDetail>({
    queryKey: ['sale-detail', id],
    queryFn: async () => {
      const res = await api.get(`/sales/${id}`);
      return res.data;
    },
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p className="text-sm">Loading invoice #{id}...</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Invoice Not Found</h2>
        <p className="text-sm text-slate-400 mt-1">The requested sales invoice could not be retrieved.</p>
        <Link href="/sales" className="mt-6 inline-block">
          <Button variant="primary">Return to Sales History</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <Link href="/sales">
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to sales"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Invoice {sale.invoiceNo}
              </h1>
              <Badge variant={sale.dueAmount > 0 ? 'warning' : 'success'}>
                {sale.dueAmount > 0 ? 'PARTIAL / DUE' : 'PAID'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Issued on {formatDateTime(sale.createdAt)} · Pricing: {sale.pricingTier || 'RETAIL'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print Receipt
          </Button>

          <Button
            variant="danger"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setShowReturnModal(true)}
          >
            Process Return
          </Button>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <User className="w-4 h-4 text-blue-400" />
            Customer Info
          </div>
          <div>
            <p className="text-base font-bold text-white">
              {sale.customerId?.name || 'Walk-in Customer'}
            </p>
            {sale.customerId?.phone && (
              <p className="text-xs text-slate-400 mt-0.5">Phone: {sale.customerId.phone}</p>
            )}
            {sale.customerId?._id && (
              <Link
                href={`/customers/${sale.customerId._id}/ledger`}
                className="text-xs text-blue-400 hover:underline mt-1 inline-block"
              >
                View Bakir Khata Ledger →
              </Link>
            )}
          </div>
        </div>

        {/* Cashier & Terminal Information */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Cashier & Session
          </div>
          <div>
            <p className="text-base font-bold text-white">
              {sale.cashierId?.fullName || sale.cashierId?.username || 'Staff'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Shift ID: {sale.shiftId || 'Direct / General'}
            </p>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Bill:</span>
            <span className="font-semibold text-white">{formatCurrency(sale.totalAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Paid Amount:</span>
            <span className="font-semibold text-emerald-400">{formatCurrency(sale.paidAmount)}</span>
          </div>
          {sale.dueAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-rose-400 font-bold border-t border-slate-800 pt-1">
              <span>Outstanding Due:</span>
              <span>{formatCurrency(sale.dueAmount)}</span>
            </div>
          )}
          {sale.changeReturned > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Change Returned:</span>
              <span className="font-semibold text-white">{formatCurrency(sale.changeReturned)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Items Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Invoice Items</h2>
          <span className="text-xs text-slate-400 font-medium">
            {sale.items?.length || 0} Line Item{(sale.items?.length || 0) === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Product & SKU</th>
                <th className="px-6 py-3.5 text-center">Qty</th>
                <th className="px-6 py-3.5 text-right">Unit Price</th>
                <th className="px-6 py-3.5 text-right">Discount</th>
                <th className="px-6 py-3.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {sale.items?.map((item, index) => (
                <tr key={index} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{item.productName}</p>
                    <p className="text-xs text-slate-400">
                      {item.variantName ? `${item.variantName} · ` : ''}SKU: {item.sku}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-white">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {formatCurrency(item.unitSellingPrice)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-amber-400">
                    {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-800/30 text-sm font-semibold border-t border-slate-800">
              <tr>
                <td colSpan={4} className="px-6 py-3 text-right text-slate-400">Subtotal:</td>
                <td className="px-6 py-3 text-right font-mono text-white">{formatCurrency(sale.subtotal)}</td>
              </tr>
              {sale.totalTax > 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-2 text-right text-slate-400">Total Tax:</td>
                  <td className="px-6 py-2 text-right font-mono text-white">{formatCurrency(sale.totalTax)}</td>
                </tr>
              )}
              {sale.discountAmount > 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-2 text-right text-amber-400">Overall Discount:</td>
                  <td className="px-6 py-2 text-right font-mono text-amber-400">-{formatCurrency(sale.discountAmount)}</td>
                </tr>
              )}
              <tr className="border-t border-slate-700 bg-slate-800/60">
                <td colSpan={4} className="px-6 py-3.5 text-right text-white font-bold text-base">Grand Total:</td>
                <td className="px-6 py-3.5 text-right font-mono font-black text-emerald-400 text-lg">{formatCurrency(sale.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Payment Tenders Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          Payment Tender Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sale.payments?.map((p, idx) => (
            <div key={idx} className="bg-slate-800/70 border border-slate-700 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">{p.method}</span>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(p.amount)}</p>
              {p.reference && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">Ref: {p.reference}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Return Modal */}
      {showReturnModal && (
        <ReturnModal
          sale={sale}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
            success('Return recorded successfully');
            refetch();
          }}
        />
      )}
    </div>
  );
}
