'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  Receipt,
  Truck,
  Package,
  Tags,
  ArrowRight,
  RefreshCw,
  PackageCheck,
  Warehouse,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../lib/i18n';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { KpiCard } from '../../../components/reports/KpiCard';
import { money } from '../../../components/reports/ReportShell';

/**
 * Trade & Inventory Management — the single entry point for the five modules
 * that one trading department actually uses together:
 *
 *   Smart POS · Sales · Purchase · Inventory · Wholesale & Retail
 *
 * It is a working dashboard, not just a menu: each card carries the live
 * numbers for that module and links straight into its pages.
 */
interface ModuleLink {
  labelKey: string;
  href: string;
  permission?: string;
}

export default function TradeInventoryPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const can = (permission?: string) => {
    if (!permission || !user) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return (user.permissions || []).includes(permission);
  };

  /* ── Live numbers ───────────────────────────────────────────────────────── */
  // Every figure is optional: someone without reporting rights sees a dash,
  // never a misleading zero.
  const { data: dashboard, refetch } = useQuery<any>({
    queryKey: ['trade-dashboard'],
    queryFn: async () => {
      try {
        return (await api.get('/reports/dashboard')).data;
      } catch {
        return null;
      }
    },
  });

  const { data: pendingReceive } = useQuery<any>({
    queryKey: ['trade-pending-receive'],
    queryFn: async () => {
      try {
        return (await api.get('/purchase-orders/pending-receive')).data;
      } catch {
        return null; // no procurement rights → simply no figure
      }
    },
  });

  const { data: incoming } = useQuery<any>({
    queryKey: ['trade-incoming'],
    queryFn: async () => {
      try {
        return (await api.get('/stock-transfers/incoming')).data;
      } catch {
        return null;
      }
    },
  });

  const { data: tiers = [] } = useQuery<any[]>({
    queryKey: ['trade-price-tiers'],
    queryFn: async () => {
      try {
        const res = await api.get('/price-tiers');
        return (Array.isArray(res.data) ? res.data : (res.data as any)?.data) || [];
      } catch {
        return [];
      }
    },
  });

  const today = dashboard?.today || {};
  const kpis = dashboard?.kpis || {};
  const dash = (value: string) => (dashboard ? value : '—');

  const modules: {
    key: string;
    icon: React.ElementType;
    titleKey: string;
    descKey: string;
    accent: string;
    stats: { labelKey: string; value: string; tone: 'emerald' | 'amber' | 'rose' | 'white' | 'indigo' | 'purple' }[];
    links: ModuleLink[];
  }[] = [
    {
      key: 'pos',
      icon: ShoppingCart,
      titleKey: 'trade.pos',
      descKey: 'trade.posDesc',
      accent: 'from-violet-600 to-indigo-700',
      stats: [
        { labelKey: 'dashboard.todaySales', value: dash(money(today.revenue)), tone: 'emerald' },
        { labelKey: 'common.invoices', value: dash(String(today.orders ?? 0)), tone: 'white' },
      ],
      links: [
        { labelKey: 'trade.openPos', href: '/pos', permission: 'pos:checkout' },
        { labelKey: 'nav.shifts', href: '/shifts', permission: 'shifts:operate' },
        { labelKey: 'nav.mySales', href: '/my-sales' },
      ],
    },
    {
      key: 'sales',
      icon: Receipt,
      titleKey: 'trade.sales',
      descKey: 'trade.salesDesc',
      accent: 'from-amber-400 to-yellow-500',
      stats: [
        { labelKey: 'dashboard.todaySales', value: dash(money(today.revenue)), tone: 'emerald' },
        { labelKey: 'dashboard.customerDues', value: dash(money(kpis.customerDues)), tone: 'rose' },
      ],
      links: [
        { labelKey: 'nav.salesHistory', href: '/sales', permission: 'sales:view' },
        { labelKey: 'trade.salesInsights', href: '/reports/sales-insights', permission: 'reports:sales' },
        { labelKey: 'nav.customers', href: '/customers', permission: 'customers:view' },
      ],
    },
    {
      key: 'purchase',
      icon: Truck,
      titleKey: 'trade.purchase',
      descKey: 'trade.purchaseDesc',
      accent: 'from-orange-500 to-amber-600',
      stats: [
        {
          labelKey: 'trade.waitingReceive',
          value: pendingReceive ? String(pendingReceive.summary?.purchases ?? 0) : '—',
          tone: 'amber',
        },
        { labelKey: 'dashboard.supplierPayables', value: dash(money(kpis.supplierPayables)), tone: 'rose' },
      ],
      links: [
        { labelKey: 'nav.purchaseOrders', href: '/purchase-orders', permission: 'procurement:view' },
        { labelKey: 'nav.purchaseReceive', href: '/purchase-orders/receive', permission: 'procurement:receive' },
        { labelKey: 'nav.purchaseReturns', href: '/purchase-orders/returns', permission: 'procurement:view' },
        { labelKey: 'nav.suppliers', href: '/suppliers', permission: 'procurement:view' },
      ],
    },
    {
      key: 'inventory',
      icon: Package,
      titleKey: 'trade.inventory',
      descKey: 'trade.inventoryDesc',
      accent: 'from-fuchsia-500 to-pink-600',
      stats: [
        { labelKey: 'dashboard.inventoryValue', value: dash(money(kpis.inventoryValuation)), tone: 'indigo' },
        { labelKey: 'dashboard.lowStock', value: dash(String(kpis.lowStockItems ?? 0)), tone: 'amber' },
      ],
      links: [
        { labelKey: 'nav.allProducts', href: '/products', permission: 'inv:view' },
        { labelKey: 'nav.inventory', href: '/inventory', permission: 'inv:view' },
        { labelKey: 'nav.stockTransfers', href: '/stock-transfers', permission: 'inv:view' },
        { labelKey: 'nav.incomingStock', href: '/stock-transfers', permission: 'inv:view' },
        { labelKey: 'nav.categories', href: '/categories', permission: 'inv:view' },
        { labelKey: 'nav.brands', href: '/brands', permission: 'inv:view' },
        { labelKey: 'nav.productGroups', href: '/product-groups', permission: 'inv:view' },
        { labelKey: 'nav.barcodeLabels', href: '/barcode-labels', permission: 'inv:labels' },
        { labelKey: 'nav.chainDashboard', href: '/chain-management', permission: 'reports:dashboard' },
      ],
    },
    {
      key: 'wholesale',
      icon: Tags,
      titleKey: 'trade.wholesale',
      descKey: 'trade.wholesaleDesc',
      accent: 'from-pink-500 to-rose-600',
      stats: [
        { labelKey: 'trade.priceTiers', value: String(Array.isArray(tiers) ? tiers.length : 0), tone: 'purple' },
        {
          labelKey: 'trade.incomingValue',
          value: incoming ? money(incoming.summary?.value) : '—',
          tone: 'white',
        },
      ],
      links: [
        { labelKey: 'nav.priceTiers', href: '/price-tiers', permission: 'customers:view' },
        { labelKey: 'trade.volumePricing', href: '/price-tiers/volume-pricing', permission: 'pricing:manage' },
        { labelKey: 'trade.channelSplit', href: '/reports/business-ops', permission: 'reports:sales' },
      ],
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-700 shadow-lg shadow-indigo-900/30">
            <Warehouse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('trade.title')}</h1>
            <p className="text-xs text-slate-400">{t('trade.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {can('pos:checkout') && (
            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> {t('header.openPos')}
            </Link>
          )}
        </div>
      </div>

      {/* Cross-module strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('dashboard.todaySales')}
          value={dash(money(today.revenue))}
          tone="emerald"
          hint={dashboard ? `${today.orders ?? 0} ${t('common.invoices').toLowerCase()}` : undefined}
        />
        <KpiCard
          label={t('trade.waitingReceive')}
          value={pendingReceive ? String(pendingReceive.summary?.purchases ?? 0) : '—'}
          tone="amber"
          hint={pendingReceive ? money(pendingReceive.summary?.pendingValue) : undefined}
        />
        <KpiCard
          label={t('nav.incomingStock')}
          value={incoming ? String(incoming.summary?.transfers ?? 0) : '—'}
          tone="indigo"
          hint={incoming ? money(incoming.summary?.value) : undefined}
        />
        <KpiCard
          label={t('dashboard.lowStock')}
          value={dash(String(kpis.lowStockItems ?? 0))}
          tone="rose"
          hint={dashboard ? money(kpis.inventoryValuation) : undefined}
        />
      </div>

      {/* The five modules */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {modules.map((mod) => {
          const visibleLinks = mod.links.filter((l) => can(l.permission));
          return (
            <section
              key={mod.key}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col"
            >
              <div className={`bg-gradient-to-r ${mod.accent} px-4 py-3 flex items-center gap-3`}>
                <mod.icon className="w-5 h-5 text-white shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">{t(mod.titleKey)}</h2>
                  <p className="text-[11px] text-white/80 truncate">{t(mod.descKey)}</p>
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  {mod.stats.map((stat) => (
                    <div key={stat.labelKey} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{t(stat.labelKey)}</p>
                      <p
                        className={`mt-1 text-sm font-bold ${
                          stat.tone === 'emerald'
                            ? 'text-emerald-400'
                            : stat.tone === 'amber'
                            ? 'text-amber-400'
                            : stat.tone === 'rose'
                            ? 'text-rose-400'
                            : stat.tone === 'indigo'
                            ? 'text-indigo-400'
                            : stat.tone === 'purple'
                            ? 'text-purple-400'
                            : 'text-white'
                        }`}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {visibleLinks.map((link) => (
                    <Link
                      key={`${link.href}-${link.labelKey}`}
                      href={link.href}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
                    >
                      <span>{t(link.labelKey)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </Link>
                  ))}
                  {visibleLinks.length === 0 && (
                    <p className="text-[11px] text-slate-500">{t('trade.noAccess')}</p>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Things that usually need attention today */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" /> {t('trade.needsAttention')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {Number(pendingReceive?.summary?.overdueDays ?? 0) > 0 && (
            <Link
              href="/purchase-orders/receive"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-200 hover:border-amber-500/60"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              {pendingReceive.summary.overdueDays} {t('trade.overduePurchases')}
            </Link>
          )}
          {Number(kpis.lowStockItems ?? 0) > 0 && (
            <Link
              href="/reports/low-stock"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/5 text-xs text-rose-200 hover:border-rose-500/60"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {kpis.lowStockItems} {t('trade.lowStockItems')}
            </Link>
          )}
          {Number(incoming?.summary?.transfers ?? 0) > 0 && (
            <Link
              href="/stock-transfers"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/5 text-xs text-blue-200 hover:border-blue-500/60"
            >
              <Truck className="w-3.5 h-3.5" />
              {incoming.summary.transfers} {t('trade.incomingTransfers')}
            </Link>
          )}
          {Number(kpis.customerDues ?? 0) > 0 && (
            <Link
              href="/reports/customer-aging"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/30 bg-violet-500/5 text-xs text-violet-200 hover:border-violet-500/60"
            >
              <Wallet className="w-3.5 h-3.5" />
              {t('dashboard.customerDues')}: {money(kpis.customerDues)}
            </Link>
          )}
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs text-slate-200 hover:border-slate-500"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {t('reports.title')}
          </Link>
          <Badge variant="info">{t('trade.oneDepartment')}</Badge>
        </div>
      </div>
    </div>
  );
}
