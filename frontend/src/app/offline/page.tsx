'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw, ShoppingCart } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

/**
 * Served by the service worker when a navigation cannot reach the network.
 * Keeps the door open: the POS itself keeps working offline and queues sales.
 */
export default function OfflinePage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <WifiOff className="w-6 h-6 text-amber-400" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-white">{t('pwa.offlineTitle')}</h1>
        <p className="mt-2 text-sm text-slate-400">{t('pwa.offlineBody')}</p>

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('pwa.retry')}
          </button>
          <Link
            href="/pos"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {t('header.openPos')}
          </Link>
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
