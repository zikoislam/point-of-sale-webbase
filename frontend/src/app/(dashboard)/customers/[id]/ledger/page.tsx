'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../lib/api-client';
import { useBranding } from '../../../../../hooks/useBranding';
import { useAuth } from '../../../../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../../../../lib/utils';
import { CustomerEditModal } from '../../../../../components/modals/CustomerEditModal';
import { LedgerEditModal, LedgerEntryForEdit } from '../../../../../components/modals/LedgerEditModal';
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  FileText,
  Phone,
  MapPin,
  TrendingUp,
  TrendingDown,
  Wallet,
  Pencil,
} from 'lucide-react';

interface LedgerEntry {
  _id: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  narration: string;
  transactionDate?: string;
  createdAt: string;
}

/** A brought-forward opening balance and a credit sale both raise what is owed. */
const increasesDue = (type: string) => type === 'SALE_DUE' || type === 'OPENING';
const isPayment = (type: string) =>
  type === 'PAYMENT_COLLECTION' || type === 'PAYMENT' || type === 'RETURN_CREDIT';

/** The day the money moved — the payment date when set, otherwise entry time. */
const entryDate = (e: LedgerEntry) => new Date(e.transactionDate || e.createdAt);

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The ledger endpoint pages at 100, so walk the pages to get the whole book.
 * A report that silently stopped at the first 100 rows would be worse than
 * useless, so this keeps going until the server says it has sent everything.
 */
async function fetchWholeLedger(customerId: string): Promise<LedgerEntry[]> {
  const all: LedgerEntry[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await api.get(`/customers/${customerId}/ledger`, { params: { page, limit: 100 } });
    const batch = Array.isArray(res.data?.data) ? res.data.data : [];
    all.push(...batch);
    const total = res.data?.total ?? batch.length;
    if (all.length >= total || batch.length === 0) break;
  }
  return all;
}

export default function CustomerDueReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const branding = useBranding();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editEntry, setEditEntry] = useState<LedgerEntryForEdit | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [customerEditModalOpen, setCustomerEditModalOpen] = useState(false);

  const { data: customer, refetch: refetchCustomer } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: async () => (await api.get(`/customers/${id}`)).data,
    enabled: !!id,
  });

  const {
    data: entries = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<LedgerEntry[]>({
    queryKey: ['customer-ledger-full', id],
    queryFn: () => fetchWholeLedger(id),
    enabled: !!id,
  });

  // Oldest first: a ledger reads forwards, and the running balance only makes
  // sense in that direction.
  const ordered = useMemo(
    () => [...entries].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime()),
    [entries]
  );

  const inRange = useMemo(
    () =>
      ordered.filter((e) => {
        const key = dayKey(entryDate(e));
        if (fromDate && key < fromDate) return false;
        if (toDate && key > toDate) return false;
        return true;
      }),
    [ordered, fromDate, toDate]
  );

  /** One block per calendar day, each with that day's own debit/credit totals. */
  const dayGroups = useMemo(() => {
    const groups: { key: string; date: Date; rows: LedgerEntry[]; debit: number; credit: number }[] =
      [];
    for (const e of inRange) {
      const d = entryDate(e);
      const key = dayKey(d);
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, date: d, rows: [], debit: 0, credit: 0 };
        groups.push(group);
      }
      group.rows.push(e);
      if (increasesDue(e.transactionType)) group.debit += e.amount;
      else group.credit += e.amount;
    }
    return groups;
  }, [inRange]);

  const openingBalance = ordered.length ? ordered[0].balanceBefore : 0;
  const closingBalance = inRange.length ? inRange[inRange.length - 1].balanceAfter : openingBalance;
  const totalDebit = inRange
    .filter((e) => increasesDue(e.transactionType))
    .reduce((a, e) => a + e.amount, 0);
  const totalCredit = inRange
    .filter((e) => isPayment(e.transactionType))
    .reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4 pb-12">
      {/* Report heading — also the letterhead when printed */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <Link href="/customers">
              <button
                type="button"
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors print:hidden"
                title="Back to customers"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Customer Due Detail Report
              </h1>
              <p className="text-sm text-slate-300 mt-0.5">{customer?.name || 'Customer'}</p>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {customer?.phone || 'N/A'}
                </span>
                {customer?.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {customer.address}
                  </span>
                )}
                <span className="font-medium text-slate-300">
                  {branding.shopName || 'Unique Home Textile'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setCustomerEditModalOpen(true)}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Edit Customer Info"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl print:hidden">
        <span className="text-xs font-bold text-slate-400 uppercase">Period</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
        />
        <span className="text-slate-500 text-xs font-bold">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
        />
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
          >
            Clear
          </button>
        )}
        <span className="text-[11px] text-slate-500 ml-auto">
          Showing {inRange.length} of {ordered.length} entries
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Opening Balance</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-black text-white mt-1">{formatCurrency(openingBalance)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Due Added</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-black text-rose-400 mt-1">{formatCurrency(totalDebit)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Collected</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Closing Balance</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-400 mt-1">{formatCurrency(closingBalance)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Credit limit {formatCurrency(customer?.creditLimit || 0)}
          </p>
        </div>
      </div>

      {/* Date-by-date ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Ledger — date by date
          </h2>
          <span className="text-xs text-slate-400">{ordered.length} entries</span>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Loading ledger...
          </div>
        ) : ordered.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No ledger entries for this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/60 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Narration</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 text-center print:hidden">Edit</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {dayGroups.map((group) => (
                  <React.Fragment key={group.key}>
                    {/* one band per day, carrying that day's own totals */}
                    <tr className="bg-slate-950/60 border-y border-slate-800">
                      <td
                        colSpan={isSuperAdmin ? 7 : 6}
                        className="px-4 py-2 font-bold text-slate-200 text-[11px] uppercase tracking-wide"
                      >
                        {formatDate(group.date)}
                        <span className="ml-3 font-normal normal-case text-slate-400">
                          {group.rows.length} entr{group.rows.length === 1 ? 'y' : 'ies'}
                          {group.debit > 0 && (
                            <span className="ml-3 text-rose-400">
                              due {formatCurrency(group.debit)}
                            </span>
                          )}
                          {group.credit > 0 && (
                            <span className="ml-3 text-emerald-400">
                              paid {formatCurrency(group.credit)}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                    {group.rows.map((e) => {
                      const debit = increasesDue(e.transactionType);
                      return (
                        <tr key={e._id} className="border-b border-slate-800/60">
                          <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                            {formatDate(entryDate(e))}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {e.transactionType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">{e.narration || '-'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-rose-400">
                            {debit ? formatCurrency(e.amount) : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                            {!debit && isPayment(e.transactionType) ? formatCurrency(e.amount) : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-amber-300">
                            {formatCurrency(e.balanceAfter)}
                          </td>
                          {isSuperAdmin && (
                            <td className="px-4 py-2.5 text-center print:hidden">
                              <button
                                type="button"
                                title="Edit this ledger entry"
                                onClick={() => {
                                  setEditEntry(e as LedgerEntryForEdit);
                                  setEditModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-slate-700 hover:border-indigo-500/40 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-slate-700 font-bold text-white">
                  <td colSpan={3} className="px-4 py-3 uppercase text-[11px] tracking-wide">
                    Total — {dayGroups.length} day{dayGroups.length === 1 ? '' : 's'}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(totalDebit)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-300">
                    {formatCurrency(closingBalance)}
                  </td>
                  {isSuperAdmin && <td className="print:hidden" />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Super Admin: Edit ledger entry modal */}
      {isSuperAdmin && (
        <LedgerEditModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditEntry(null);
          }}
          onSuccess={() => {
            refetch();
          }}
          customerId={id}
          entry={editEntry}
        />
      )}

      {/* Edit Customer Info Modal */}
      <CustomerEditModal
        isOpen={customerEditModalOpen}
        onClose={() => setCustomerEditModalOpen(false)}
        customer={customer?.data || customer} // Handle backend response wrapping if any
        isSuperAdmin={isSuperAdmin}
        onSuccess={() => {
          refetchCustomer();
        }}
      />
    </div>
  );
}
