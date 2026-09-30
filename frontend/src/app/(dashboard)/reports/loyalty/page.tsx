'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Award, RefreshCw, Users, TrendingUp, Flame, Settings } from 'lucide-react';
import { KpiCard } from '../../../../components/reports/KpiCard';
import { ReportTable, money } from '../../../../components/reports/ReportShell';
import { useReportData } from '../../../../components/reports/useReportData';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';

/**
 * Loyalty analytics — what the programme costs and what it earns back.
 *
 * No export buttons here on purpose: the loyalty report has no PDF/Excel
 * renderer on the backend, and a button that 404s is worse than no button.
 */
interface Holder {
  _id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  lifetimePoints: number;
}

interface Analytics {
  summary: {
    isActive: boolean;
    earnedPoints: number;
    redeemedPoints: number;
    expiredPoints: number;
    earnMovements: number;
    redeemMovements: number;
    redemptionRatePercent: number;
    pointsOutstanding: number;
    holders: number;
    liabilityValue: number;
    activeMembers: number;
    pointValue: number;
  };
  tiers: { tier: string; customers: number }[];
  topHolders: Holder[];
  data: { type: string; points: number; movements: number }[];
}

const TIER_STYLE: Record<string, string> = {
  NONE: 'bg-slate-700/40 text-slate-300 border-slate-600',
  SILVER: 'bg-slate-300/20 text-slate-100 border-slate-300',
  GOLD: 'bg-amber-500/20 text-amber-300 border-amber-500',
  PLATINUM: 'bg-cyan-500/20 text-cyan-200 border-cyan-400',
};

export default function LoyaltyAnalyticsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, loading, error, reload } = useReportData<Analytics>(
    '/crm/loyalty/analytics',
    startDate,
    endDate
  );

  const s = data?.summary;
  const movements = data?.data || [];

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Loyalty Programme Analytics</h1>
            <p className="text-sm text-slate-400">
              Points earned, redeemed and expired — plus what the outstanding balance would cost
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />} onClick={reload}>
            Refresh
          </Button>
          <Link href="/settings/loyalty">
            <Button variant="primary" leftIcon={<Settings className="w-4 h-4" />}>
              Programme settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <span className="text-xs font-bold text-slate-400 uppercase">Period</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
        />
        <span className="text-slate-500 text-xs font-bold">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
        />
        <span className="text-[11px] text-slate-500">Leave both empty for all time</span>
        {s && (
          <Badge variant={s.isActive ? 'success' : 'danger'} size="sm">
            {s.isActive ? 'Programme active' : 'Programme paused'}
          </Badge>
        )}
      </div>

      {error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm">{error}</div>
      ) : loading ? (
        <div className="flex justify-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Points earned"
              value={String(s?.earnedPoints ?? 0)}
              tone="emerald"
              hint={`${s?.earnMovements ?? 0} earning bill(s)`}
            />
            <KpiCard
              label="Points redeemed"
              value={String(s?.redeemedPoints ?? 0)}
              tone="indigo"
              hint={`${s?.redemptionRatePercent ?? 0}% of what was earned`}
            />
            <KpiCard
              label="Points expired"
              value={String(s?.expiredPoints ?? 0)}
              tone="rose"
              hint={s?.expiredPoints ? 'Lapsed by the expiry rule' : 'No points have lapsed'}
            />
            <KpiCard
              label="Outstanding liability"
              value={money(s?.liabilityValue ?? 0)}
              tone="amber"
              hint={`${s?.pointsOutstanding ?? 0} points held by ${s?.holders ?? 0} customer(s)`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Movement summary */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-amber-400" /> Movements in this period
              </h3>
              <ul className="space-y-2 text-xs">
                {movements.length === 0 && <li className="text-slate-500">No movements in this period.</li>}
                {movements.map((m) => (
                  <li key={m.type} className="flex items-center justify-between bg-slate-950/50 rounded-xl px-3 py-2">
                    <span className="text-slate-300">{m.type}</span>
                    <span className="text-white font-bold">
                      {m.points} <span className="text-slate-500 font-normal">pts · {m.movements}×</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                <p className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> {s?.activeMembers ?? 0} member(s) have ever earned
                </p>
                <p className="mt-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> 1 point = {money(s?.pointValue ?? 0)}
                </p>
              </div>
            </div>

            {/* Tier split */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Customers per tier</h3>
              <div className="flex flex-wrap gap-2">
                {(data?.tiers || []).map((t) => (
                  <div
                    key={t.tier}
                    className={`px-4 py-3 rounded-xl border ${
                      TIER_STYLE[t.tier] || TIER_STYLE.NONE
                    } min-w-[120px]`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide">{t.tier}</p>
                    <p className="text-xl font-black">{t.customers}</p>
                  </div>
                ))}
                {(data?.tiers || []).length === 0 && (
                  <p className="text-slate-500 text-xs">No customer has earned a tier yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Top holders */}
          <ReportTable
            headers={[
              { label: '#', align: 'center' },
              { label: 'Customer' },
              { label: 'Phone' },
              { label: 'Tier', align: 'center' },
              { label: 'Points balance', align: 'right' },
              { label: 'Value', align: 'right' },
              { label: 'Lifetime points', align: 'right' },
            ]}
            isEmpty={(data?.topHolders || []).length === 0}
            empty="No customer holds points yet."
          >
            {(data?.topHolders || []).map((h, i) => (
              <tr key={h._id} className="hover:bg-slate-800/40">
                <td className="py-3 px-4 text-center text-slate-500">{i + 1}</td>
                <td className="py-3 px-4">
                  <Link href={`/customers/${h._id}/loyalty`} className="text-white font-semibold hover:text-blue-300">
                    {h.name}
                  </Link>
                </td>
                <td className="py-3 px-4 text-slate-400">{h.phone}</td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                      TIER_STYLE[h.loyaltyTier] || TIER_STYLE.NONE
                    }`}
                  >
                    {h.loyaltyTier || 'NONE'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-white">{h.loyaltyPoints}</td>
                <td className="py-3 px-4 text-right text-emerald-300">
                  {money(h.loyaltyPoints * (s?.pointValue ?? 0))}
                </td>
                <td className="py-3 px-4 text-right text-slate-400">{h.lifetimePoints || 0}</td>
              </tr>
            ))}
          </ReportTable>
        </>
      )}
    </div>
  );
}
