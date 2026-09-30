'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Save, RefreshCw, Plus, Trash2, BarChart3, Sparkles } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Spinner } from '../../../../components/ui/Spinner';
import { useToast } from '../../../../components/ui/Toast';
import { useAuth } from '../../../../hooks/useAuth';

/**
 * Loyalty programme settings — the single place these rules are edited.
 *
 * Earning rate, redemption value and limits, how long points live, and the tier
 * ladder that pays a bonus multiplier. The POS reads all of this live.
 */
interface Tier {
  name: string;
  minLifetimePoints: number;
  bonusMultiplier: number;
}

interface LoyaltyConfig {
  pointsPerTk: number;
  redeemValuePerPoint: number;
  minPointsToRedeem: number;
  maxRedeemPercent: number;
  expiryDays: number;
  tiers: Tier[];
  isActive: boolean;
}

export default function LoyaltySettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const canEdit = isSuper || perms.includes('crm:loyalty');

  const [form, setForm] = useState<LoyaltyConfig | null>(null);

  const { data, isLoading } = useQuery<LoyaltyConfig>({
    queryKey: ['loyalty-config'],
    queryFn: async () => (await api.get('/crm/loyalty')).data,
  });

  useEffect(() => {
    if (data) {
      setForm({
        pointsPerTk: data.pointsPerTk ?? 0.05,
        redeemValuePerPoint: data.redeemValuePerPoint ?? 0.5,
        minPointsToRedeem: data.minPointsToRedeem ?? 100,
        maxRedeemPercent: data.maxRedeemPercent ?? 100,
        expiryDays: data.expiryDays ?? 0,
        tiers: data.tiers || [],
        isActive: data.isActive ?? true,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await api.put('/crm/loyalty', form);
    },
    onSuccess: () => {
      toast.success('Loyalty programme saved');
      queryClient.invalidateQueries({ queryKey: ['loyalty-config'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sweep = useMutation({
    mutationFn: async () => (await api.post('/crm/loyalty/expire')).data,
    onSuccess: (result: any) =>
      toast.success(
        result?.points
          ? `${result.points} expired point(s) across ${result.customers} customer(s)`
          : 'Nothing to expire right now'
      ),
    onError: (e: any) => toast.error(e.message),
  });

  const setTier = (index: number, patch: Partial<Tier>) => {
    if (!form) return;
    const tiers = form.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    setForm({ ...form, tiers });
  };

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const exampleSpend = 500;
  const examplePoints = Math.floor(exampleSpend * (form.pointsPerTk || 0));

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Loyalty Programme</h1>
            <p className="text-sm text-slate-400">
              Earning, redemption, expiry and the tier ladder — applied automatically at checkout
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports/loyalty">
            <Button variant="outline" leftIcon={<BarChart3 className="w-4 h-4" />}>
              Programme Analytics
            </Button>
          </Link>
          {canEdit && (
            <Button
              variant="primary"
              leftIcon={<Save className="w-4 h-4" />}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Earning & redemption */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Earning &amp; redemption
          </h3>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Points per ৳1 spent
            </label>
            <Input
              type="number"
              step="0.01"
              value={form.pointsPerTk}
              disabled={!canEdit}
              onChange={(e: any) => setForm({ ...form, pointsPerTk: Number(e.target.value) })}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              A ৳{exampleSpend} sale earns {examplePoints} point(s).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              ৳ value of one point
            </label>
            <Input
              type="number"
              step="0.01"
              value={form.redeemValuePerPoint}
              disabled={!canEdit}
              onChange={(e: any) => setForm({ ...form, redeemValuePerPoint: Number(e.target.value) })}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              100 points = ৳{(100 * (form.redeemValuePerPoint || 0)).toFixed(2)} off a bill.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Minimum points to redeem
              </label>
              <Input
                type="number"
                value={form.minPointsToRedeem}
                disabled={!canEdit}
                onChange={(e: any) => setForm({ ...form, minPointsToRedeem: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Max % of a bill
              </label>
              <Input
                type="number"
                value={form.maxRedeemPercent}
                disabled={!canEdit}
                onChange={(e: any) => setForm({ ...form, maxRedeemPercent: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Points may never pay for more than {form.maxRedeemPercent}% of a bill — the cashier still collects the rest.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Points expire after (days)
            </label>
            <Input
              type="number"
              value={form.expiryDays}
              disabled={!canEdit}
              onChange={(e: any) => setForm({ ...form, expiryDays: Number(e.target.value) })}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {form.expiryDays > 0
                ? `Points die ${form.expiryDays} day(s) after they are earned (oldest first).`
                : '0 = points never expire.'}
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              className="accent-emerald-500"
              checked={form.isActive}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Programme active
          </label>
        </div>

        {/* Tier ladder */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Tier ladder</h3>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() =>
                  setForm({
                    ...form,
                    tiers: [...form.tiers, { name: 'NEW TIER', minLifetimePoints: 0, bonusMultiplier: 1 }],
                  })
                }
              >
                Add tier
              </Button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Tiers are judged on <strong>lifetime</strong> points (spending them never demotes a customer). The
            multiplier boosts every future earning.
          </p>

          <div className="space-y-2">
            {form.tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center bg-slate-950/50 border border-slate-800 rounded-xl p-3">
                <input
                  value={tier.name}
                  disabled={!canEdit}
                  onChange={(e) => setTier(index, { name: e.target.value.toUpperCase() })}
                  className="col-span-4 h-9 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white uppercase"
                />
                <div className="col-span-4">
                  <input
                    type="number"
                    value={tier.minLifetimePoints}
                    disabled={!canEdit}
                    onChange={(e) => setTier(index, { minLifetimePoints: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    title="Minimum lifetime points"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">min lifetime pts</p>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    step="0.05"
                    value={tier.bonusMultiplier}
                    disabled={!canEdit}
                    onChange={(e) => setTier(index, { bonusMultiplier: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                    title="Earn multiplier"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">× earn rate</p>
                </div>
                <div className="col-span-1 text-right">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, i) => i !== index) })}
                      className="p-1.5 text-rose-400 hover:bg-slate-800 rounded-lg"
                      title="Remove tier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {form.tiers.length === 0 && (
              <p className="py-6 text-center text-slate-500 text-xs">
                No tiers — every customer earns at the base rate.
              </p>
            )}
          </div>

          {form.expiryDays > 0 && canEdit && (
            <div className="pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                loading={sweep.isPending}
                onClick={() => sweep.mutate()}
              >
                Run expiry sweep now
              </Button>
              <p className="text-[11px] text-slate-500 mt-1">
                Also runs automatically every day at 03:00.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
