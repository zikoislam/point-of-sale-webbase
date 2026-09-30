'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, FileDown, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../../../../lib/api-client';
import { Button } from '../../../../../components/ui/Button';
import { useBranding } from '../../../../../hooks/useBranding';

/**
 * Wholesale invoice — a proper A4 trade document for a dealer sale.
 *
 * Everything printed here comes from real records: the letterhead from settings,
 * the buyer (with BIN/TIN), VAT per line, the tenders actually received and the
 * credit terms on the customer. Nothing is invented.
 */
interface SaleItem {
  productName: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitSellingPrice: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  lineTotal: number;
}

interface SaleDetail {
  _id: string;
  invoiceNo: string;
  createdAt: string;
  pricingTier: string;
  items: SaleItem[];
  subtotal: number;
  totalTax: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeReturned: number;
  dueAmount: number;
  payments: { method: string; amount: number; transactionRef?: string }[];
  customerId?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxId?: string;
    creditDays?: number;
    currentDueBalance?: number;
  };
  cashierId?: { fullName?: string; username?: string };
  salesRepId?: { name: string; code: string };
}

export default function WholesaleInvoicePage() {
  const params = useParams();
  const id = params?.id as string;
  const branding = useBranding();

  const { data: sale, isLoading, error, refetch } = useQuery<SaleDetail>({
    queryKey: ['wholesale-invoice', id],
    queryFn: async () => (await api.get(`/sales/${id}`)).data,
  });

  const cur = branding.currencySymbol || '৳';
  const money = (n: number) => `${cur}${(n || 0).toFixed(2)}`;
  const hasVat = (sale?.items || []).some((i) => (i.taxAmount || 0) > 0);

  const openPdf = () => window.open(`/api/v1/sales/${id}/wholesale-invoice`, '_blank');

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p className="text-sm">Preparing the invoice…</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Invoice not found</h2>
        <p className="text-sm text-slate-400 mt-1">That sale could not be loaded.</p>
        <Link href="/sales" className="mt-6 inline-block">
          <Button variant="primary">Back to Sales</Button>
        </Link>
      </div>
    );
  }

  const buyer = sale.customerId;

  return (
    <div className="space-y-4 pb-16">
      {/* Toolbar — never printed */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <Link href={`/sales/${id}`}>
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to the sale"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Wholesale invoice {sale.invoiceNo}</h1>
            <p className="text-xs text-slate-400">
              A4 trade invoice · {sale.pricingTier === 'WHOLESALE' ? 'Wholesale price tier' : 'Retail price tier'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="primary" leftIcon={<FileDown className="w-4 h-4" />} onClick={openPdf}>
            Download PDF
          </Button>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="bg-white text-slate-900 mx-auto w-full max-w-[210mm] p-10 shadow-2xl rounded-lg print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            {branding.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={branding.shopName} className="w-14 h-14 object-contain mb-2" />
            )}
            <h2 className="text-xl font-black tracking-tight">{branding.shopName}</h2>
            {branding.shopAddress && <p className="text-[11px] text-slate-600 mt-1">{branding.shopAddress}</p>}
            {branding.shopPhone && <p className="text-[11px] text-slate-600">Phone: {branding.shopPhone}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-black tracking-wide">WHOLESALE INVOICE</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {sale.pricingTier === 'WHOLESALE' ? 'Trade / Dealer Sale' : 'Counter Sale'}
            </p>
            <p className="text-xs font-bold mt-3">Invoice No: {sale.invoiceNo}</p>
            <p className="text-[11px] text-slate-600">
              Date: {new Date(sale.createdAt).toLocaleDateString('en-GB')} ·{' '}
              {new Date(sale.createdAt).toLocaleTimeString('en-GB')}
            </p>
          </div>
        </div>

        {/* Buyer / context */}
        <div className="flex items-start justify-between mt-5">
          <div className="max-w-[60%]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill to</p>
            <p className="text-base font-bold mt-1">{buyer?.name || 'Walk-in Customer'}</p>
            {buyer?.address && <p className="text-[11px] text-slate-600">{buyer.address}</p>}
            {buyer?.phone && <p className="text-[11px] text-slate-600">Phone: {buyer.phone}</p>}
            {buyer?.taxId && <p className="text-[11px] text-slate-600">BIN / TIN: {buyer.taxId}</p>}
          </div>
          <div className="text-right text-[11px] text-slate-600 space-y-0.5">
            {sale.salesRepId?.name && <p>Sales rep: {sale.salesRepId.name}</p>}
            {(sale.cashierId?.fullName || sale.cashierId?.username) && (
              <p>Billed by: {sale.cashierId?.fullName || sale.cashierId?.username}</p>
            )}
            {buyer?.creditDays ? <p>Credit terms: {buyer.creditDays} day(s)</p> : null}
            {buyer?.currentDueBalance ? (
              <p className="text-rose-700 font-semibold">
                Previous balance: {money(buyer.currentDueBalance)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Items */}
        <table className="w-full mt-6 text-[11px] border-collapse">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100">
              <th className="py-2 px-2 text-left font-bold">#</th>
              <th className="py-2 px-2 text-left font-bold">Product</th>
              <th className="py-2 px-2 text-left font-bold">SKU</th>
              <th className="py-2 px-2 text-right font-bold">Qty</th>
              <th className="py-2 px-2 text-right font-bold">Unit price</th>
              <th className="py-2 px-2 text-right font-bold">Discount</th>
              {hasVat && <th className="py-2 px-2 text-right font-bold">VAT</th>}
              <th className="py-2 px-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={`${item.sku}-${index}`} className="border-b border-slate-200">
                <td className="py-2 px-2 text-slate-500">{index + 1}</td>
                <td className="py-2 px-2">
                  <span className="font-semibold">{item.productName}</span>
                  {item.variantName && <span className="block text-[10px] text-slate-500">{item.variantName}</span>}
                </td>
                <td className="py-2 px-2 text-slate-600">{item.sku || '—'}</td>
                <td className="py-2 px-2 text-right">{item.quantity}</td>
                <td className="py-2 px-2 text-right">{money(item.unitSellingPrice)}</td>
                <td className="py-2 px-2 text-right text-amber-700">
                  {item.discount > 0 ? `-${money(item.discount)}` : '—'}
                </td>
                {hasVat && (
                  <td className="py-2 px-2 text-right">
                    {item.taxAmount > 0 ? `${money(item.taxAmount)} (${item.taxRate || 0}%)` : '—'}
                  </td>
                )}
                <td className="py-2 px-2 text-right font-bold">{money(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + tenders */}
        <div className="flex items-start justify-between gap-8 mt-5">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment received</p>
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-700">
              {sale.payments.map((p, i) => (
                <li key={`${p.method}-${i}`}>
                  {p.method.replace(/_/g, ' ')}: <strong>{money(p.amount)}</strong>
                  {p.transactionRef ? ` (ref ${p.transactionRef})` : ''}
                </li>
              ))}
            </ul>
          </div>
          <div className="w-[45%] text-[11px]">
            <div className="flex justify-between py-1">
              <span>Subtotal</span>
              <span>{money(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between py-1">
                <span>Bill discount</span>
                <span>-{money(sale.discountAmount)}</span>
              </div>
            )}
            {sale.totalTax > 0 && (
              <div className="flex justify-between py-1">
                <span>VAT</span>
                <span>{money(sale.totalTax)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-y border-slate-300 font-black text-sm">
              <span>GRAND TOTAL</span>
              <span>{money(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Paid</span>
              <span>{money(sale.paidAmount)}</span>
            </div>
            {sale.changeReturned > 0 && (
              <div className="flex justify-between py-1">
                <span>Change returned</span>
                <span>{money(sale.changeReturned)}</span>
              </div>
            )}
            {sale.dueAmount > 0 && (
              <div className="flex justify-between py-1 font-black text-rose-700">
                <span>BALANCE DUE</span>
                <span>{money(sale.dueAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Terms &amp; conditions</p>
          <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
            {buyer?.creditDays
              ? `Payment: within ${buyer.creditDays} day(s) of this invoice. `
              : 'Payment: cash / as agreed at the time of sale. '}
            Goods are sold on the terms agreed between the parties; shortage or damage must be reported within 3 days of
            receipt. This invoice is the proof of purchase — please retain it for any return or adjustment.
          </p>
        </div>

        {/* Signatures */}
        <div className="flex items-end justify-between mt-16">
          <div className="w-[45%] border-t border-slate-400 pt-1">
            <p className="text-[10px] text-slate-600">Authorized Signature</p>
          </div>
          <div className="w-[45%] border-t border-slate-400 pt-1">
            <p className="text-[10px] text-slate-600">Received By (Buyer)</p>
          </div>
        </div>

        <p className="text-[9px] text-slate-400 mt-6 text-center">
          {branding.shopName} — Invoice {sale.invoiceNo}
        </p>
      </div>
    </div>
  );
}
