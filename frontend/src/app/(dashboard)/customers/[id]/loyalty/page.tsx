'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, TrendingUp, RefreshCw, Sparkles, Gift, Clock } from 'lucide-react';
import { api } from '../../../../../lib/api-client';
import { Badge } from '../../../../../components/ui/Badge';
import { Button } from '../../../../../components/ui/Button';
import { Spinner } from '../../../../../components/ui/Spinner';

/**
 * A customer's loyalty statement.
 *
 * Shows the balance, the tier they sit in, how far the next tier is, and every
 * movement — so a disputed balance can always be explained movement by movement.
 */
interface Movement {
  _id: string;
  type: 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST';
  points: number;
  balanceAfter: number;
  narration?: string;
  expiresAt?: string | null;
  createdAt: string;
  relatedSaleId?: { invoiceNo?: string; totalAmount?: number } | null;
}

interface Statement {
  customer: { id: string; name: string; phone: string; points: number; lifetimePoints: number; tier: string };
  program: {
    isActive: boolean;
    pointsPerTk: number;
    redeemValuePerPoint: number;
    minPointsToRedeem: number;
    maxRedeemPercent: number;
    expiryDays: number;
    pointValue: number;
    tierMultiplier: number;
    nextTier: { name: string; minLifetimePoints: number; pointsAway: number } | null;
  };
  transactions: Movement[];
  page: number;
  totalPages: number;
  total: number;
}

const TIER_STYLE: Record<string, string> = {
  NONE: 'bg-slate-700/40 text-slate-300 border-slate-600',
  SILVER: 'bg-slate-300/20 text-slate-100 border-slate-300',
  GOLD: 'bg-amber-500/20 text-amber-300 border-amber-500',
  PLATINUM: 'bg-cyan-500/20 text-cyan-200 border-cyan-400',
};

export default function CustomerLoyaltyPage() {
  const params = useParams();
  const customerId = params?.id as string;
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery<Statement>({
    queryKey: ['loyalty-statement', customerId, page],
    queryFn: async () => (await api.get(`/crm/loyalty/customer/${customerId}?page=${page}&limit=30`)).data,
    enabled: !!customerId,
  });

  const money = (n: number) => `৳${(n || 0).toFixed(2)}`;

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const { customer, program, transactions } = data;
  const tierClass = TIER_STYLE[customer.tier] || TIER_STYLE.NONE;

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to customers"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {customer.name}
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${tierClass}`}>
                {customer.tier === 'NONE' ? 'NO TIER' : customer.tier}
              </span>
            </h1>
            <p className="text-sm text-slate-400">Loyalty statement · {customer.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/customers/${customerId}/ledger`}>
            <Button variant="outline">Bakir Khata Ledger</Button>
          </Link>
          <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Balance + tier progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" /> Points balance
          </p>
          <p className="text-3xl font-black text-white mt-2">{customer.points}</p>
          <p className="text-xs text-slate-400 mt-1">
            Worth <strong className="text-emerald-400">{money(program.pointValue)}</strong> at checkout
          </p>
          {program.minPointsToRedeem > 0 && customer.points < program.minPointsToRedeem && (
            <p className="text-[11px] text-amber-400 mt-2">
              {program.minPointsToRedeem - customer.points} more point(s) before they can redeem
            </p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Lifetime points
          </p>
          <p className="text-3xl font-black text-white mt-2">{customer.lifetimePoints}</p>
          <p className="text-xs text-slate-400 mt-1">
            Tier multiplier <strong className="text-white">×{program.tierMultiplier}</strong> on every earn
          </p>
          {program.nextTier ? (
            <div className="mt-3">
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((customer.lifetimePoints / program.nextTier.minLifetimePoints) * 100)
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {program.nextTier.pointsAway} point(s) to {program.nextTier.name}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-cyan-300 mt-2">Top tier reached</p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Programme rules
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            <li>
              Earn: <strong>{program.pointsPerTk}</strong> point(s) per ৳1
            </li>
            <li>
              1 point = <strong>{money(program.redeemValuePerPoint)}</strong>
            </li>
            <li>
              Min redeem: <strong>{program.minPointsToRedeem}</strong> points
            </li>
            <li>
              Max per bill: <strong>{program.maxRedeemPercent}%</strong>
            </li>
            <li>
              Expiry:{' '}
              <strong>{program.expiryDays > 0 ? `${program.expiryDays} day(s)` : 'never'}</strong>
            </li>
          </ul>
          <Badge variant={program.isActive ? 'success' : 'danger'} size="sm">
            {program.isActive ? 'Program active' : 'Program paused'}
          </Badge>
        </div>
      </div>

      {/* Movements */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Point movements</h3>
          <span className="text-xs text-slate-400">{data.total} movement(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Detail</th>
                <th className="px-5 py-3 text-right">Points</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map((t) => {
                const positive = t.type === 'EARN' || t.type === 'ADJUST';
                return (
                  <tr key={t._id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-xs text-slate-300">
                      {new Date(t.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={positive ? 'success' : t.type === 'REDEEM' ? 'info' : 'warning'}
                        size="sm"
                      >
                        {t.type}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {t.relatedSaleId?.invoiceNo && (
                        <span className="text-slate-300">{t.relatedSaleId.invoiceNo} · </span>
                      )}
                      {t.narration || '—'}
                      {t.expiresAt && (
                        <span className="ml-1 inline-flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          expires {new Date(t.expiresAt).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-right font-bold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {positive ? '+' : '−'}
                      {t.points}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-300">{t.balanceAfter}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    <Gift className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No point movements yet — they are earned on this customer&apos;s next sale.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
