'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, KeyRound, Loader2, LogOut, CheckCircle2, CalendarClock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api, ApiError } from '../../lib/api-client';
import { isElectron, electronBridge } from '../../lib/electron-bridge';

/**
 * "Software Locked / Payment Due" screen.
 *
 * Reached two ways: the API returns 402 (the response interceptor redirects
 * here), or ProtectedRoute notices an expired subscription. The org admin can
 * redeem a license key the Super Admin issued; on redeem the backend extends
 * the subscription and the app becomes operational again.
 *
 * This route is deliberately public (outside the (dashboard) group) so it is
 * reachable while locked, but it still requires a valid session.
 */
export default function LockedPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, refreshUser, logout } = useAuth();
  const [key, setKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const subscription = user?.subscription;
  const isExpired = subscription?.status === 'EXPIRED';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.isPlatformSuperAdmin && !user.activeOrgId) {
      router.replace('/organizations');
      return;
    }
    // Nothing to do here once the subscription is healthy again.
    if (subscription && (subscription.status === 'ACTIVE' || subscription.status === 'UNLIMITED')) {
      router.replace('/pos');
    }
  }, [isLoading, isAuthenticated, user, subscription, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Enter a license key first.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      // On the desktop build a signed offline key (POS1.…) refreshes the local
      // activation; anything else is a server-side subscription key.
      if (isElectron() && trimmed.toUpperCase().startsWith('POS1.')) {
        const result = await electronBridge.activateLicense(trimmed);
        if (!result.success) {
          setError(result.message || 'That desktop license key was rejected.');
          return;
        }
        setSuccess(true);
        setTimeout(() => window.location.reload(), 800);
        return;
      }

      await api.post('/subscription/redeem', { key: trimmed });
      await refreshUser();
      setSuccess(true);
      setTimeout(() => router.replace('/pos'), 900);
    } catch (err: any) {
      const message =
        err instanceof ApiError || err?.message
          ? err.message
          : 'Could not redeem that license key.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedExpiry = subscription?.endsAt
    ? new Date(subscription.endsAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <Lock className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Software Locked</h1>
            <p className="text-xs text-slate-400">
              {user?.orgName ? user.orgName : 'Your organization'} · subscription expired
            </p>
          </div>
        </div>

        {success ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">License activated</p>
              <p className="text-xs text-emerald-200/80">
                Your subscription has been extended. Returning to the app…
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-2 text-sm">
              {formattedExpiry && (
                <div className="flex items-center gap-2 text-slate-300">
                  <CalendarClock className="w-4 h-4 text-slate-500" />
                  <span>
                    Expired on <span className="font-semibold">{formattedExpiry}</span>
                    {isExpired && subscription!.daysOverdue > 0 && (
                      <span className="text-rose-400"> · {subscription!.daysOverdue} day(s) ago</span>
                    )}
                  </span>
                </div>
              )}
              <p className="text-slate-400">
                Enter the license key provided by your software provider to renew and unlock the
                system.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  License Key
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    placeholder="POS-XXXXXXXX-30D"
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                {error && <p className="text-rose-400 text-xs mt-2 font-medium">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Activating…
                  </>
                ) : (
                  'Activate License'
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Need a key? Contact your provider and quote your organization name.
          </p>
          <button
            type="button"
            onClick={() => logout().then(() => router.replace('/login'))}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
