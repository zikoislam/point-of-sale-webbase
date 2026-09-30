import {
  Warehouse,
  Landmark,
  CalendarCheck,
  Factory,
  Heart,
  ShoppingBag,
  MapPinned,
  Ship,
  CheckSquare,
  BarChart3,
  Shield,
} from 'lucide-react';
import type React from 'react';

/**
 * ── The module registry ───────────────────────────────────────────────────
 *
 * One source of truth for the whole application shell:
 *
 *   • components/Sidebar.tsx  — home menu, contextual (per-module) menu
 *   • app/(dashboard)/reports — "all reports" index, grouped by module
 *   • app/(dashboard)/modules — the workspace picker
 *
 * Each module owns its features *and* its reports, which is what lets the
 * sidebar show a module's reports inside that module instead of in one giant
 * central list. Adding a report to a module is a one-line change here.
 */

export interface ModuleReport {
  /** i18n key — translated at render time. */
  labelKey: string;
  href: string;
  permission?: string;
}

export interface ModuleDef {
  id: string;
  /** Display name of the department. */
  labelKey: string;
  icon: React.ElementType;
  /** Tailwind gradient for the module header / card. */
  accent: string;
  /** Where the module opens from the picker. */
  hub: string;
  /** A short line describing the module (used by the picker). */
  descKey?: string;
  /** Permission required to see the module card in the picker. */
  permission?: string;
  /**
   * The nav entry this module owns — its reports get appended there, so the
   * module's dropdown always carries the module's own reporting.
   */
  navKey?: string;
  /** Route prefixes owned by the module (its feature pages). */
  features: string[];
  /** Reports belonging to this module — shown inside the module. */
  reports: ModuleReport[];
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    id: 'trade',
    labelKey: 'nav.tradeInventory',
    descKey: 'landing.tradeDesc',
    icon: Warehouse,
    accent: 'from-violet-600 to-indigo-700',
    hub: '/trade',
    permission: 'inv:view',
    navKey: 'nav.tradeInventory',
    features: [
      '/trade', '/pos', '/shifts', '/sales', '/my-sales', '/customers',
      '/purchase-orders', '/suppliers',
      '/products', '/products/wholesale-price-list', '/categories', '/brands', '/product-groups', '/inventory', '/barcode-labels',
      '/stock-transfers', '/chain-management', '/price-tiers',
    ],
    reports: [
      { labelKey: 'nav.salesReport', href: '/reports/sales', permission: 'reports:dashboard' },
      { labelKey: 'nav.salesInsights', href: '/reports/sales-insights', permission: 'reports:dashboard' },
      { labelKey: 'nav.categoryAnalysis', href: '/reports/category-analysis', permission: 'reports:dashboard' },
      { labelKey: 'nav.purchasesSummary', href: '/reports/purchases', permission: 'reports:dashboard' },
      { labelKey: 'nav.purchaseAnalysis', href: '/reports/purchase-analysis', permission: 'reports:purchases' },
      { labelKey: 'nav.wholesaleRetailReport', href: '/reports/wholesale-retail', permission: 'reports:dashboard' },
      { labelKey: 'nav.purchaseReturnsReport', href: '/purchase-orders/returns', permission: 'procurement:view' },
      { labelKey: 'nav.inventoryValuation', href: '/reports/inventory', permission: 'reports:dashboard' },
      { labelKey: 'nav.inventorySuite', href: '/reports/inventory-suite', permission: 'reports:dashboard' },
      { labelKey: 'nav.lowStockReport', href: '/reports/low-stock', permission: 'reports:dashboard' },
      { labelKey: 'nav.deadStockReport', href: '/reports/dead-stock', permission: 'reports:dashboard' },
      { labelKey: 'nav.reorderPointReport', href: '/reports/reorder-point', permission: 'reports:dashboard' },
      { labelKey: 'nav.barcodeTracker', href: '/reports/barcode-tracker', permission: 'reports:dashboard' },
    ],
  },
  {
    id: 'accounts',
    labelKey: 'reports.accountsFinance',
    descKey: 'landing.accountsDesc',
    icon: Landmark,
    accent: 'from-emerald-500 to-green-600',
    hub: '/accounts',
    permission: 'accounts:view',
    navKey: 'nav.accounts',
    features: ['/accounts', '/expenses'],
    reports: [
      { labelKey: 'nav.profitLoss', href: '/reports/pnl', permission: 'accounts:view' },
      { labelKey: 'nav.trialBalance', href: '/reports/trial-balance', permission: 'accounts:view' },
      { labelKey: 'nav.balanceSheet', href: '/reports/balance-sheet', permission: 'accounts:view' },
      { labelKey: 'nav.cashFlow', href: '/reports/cash-flow', permission: 'accounts:view' },
      { labelKey: 'nav.customerDueAging', href: '/reports/customer-aging', permission: 'accounts:view' },
      { labelKey: 'nav.supplierPayable', href: '/reports/supplier-payable', permission: 'accounts:view' },
    ],
  },
  {
    id: 'hr',
    labelKey: 'reports.hrPayroll',
    descKey: 'landing.hrDesc',
    icon: CalendarCheck,
    accent: 'from-cyan-500 to-sky-600',
    hub: '/hr',
    permission: 'hr:view',
    navKey: 'nav.hrPayroll',
    features: ['/hr'],
    reports: [
      { labelKey: 'nav.attendanceReport', href: '/hr', permission: 'hr:view' },
      { labelKey: 'nav.leaveRegister', href: '/hr/leave', permission: 'hr:view' },
    ],
  },
  {
    id: 'production',
    labelKey: 'reports.production',
    descKey: 'landing.productionDesc',
    icon: Factory,
    accent: 'from-lime-500 to-green-600',
    hub: '/production',
    permission: 'production:view',
    navKey: 'nav.production',
    features: ['/production'],
    reports: [
      { labelKey: 'nav.productionRuns', href: '/production', permission: 'production:view' },
      { labelKey: 'nav.wastageReport', href: '/reports/wastage', permission: 'reports:dashboard' },
    ],
  },
  {
    id: 'crm',
    labelKey: 'reports.crmEcommerce',
    descKey: 'landing.crmDesc',
    icon: Heart,
    accent: 'from-rose-500 to-pink-600',
    hub: '/crm',
    permission: 'crm:view',
    navKey: 'nav.crm',
    features: ['/crm', '/leads', '/support'],
    reports: [
      { labelKey: 'nav.leadPipeline', href: '/leads', permission: 'crm:view' },
      { labelKey: 'nav.customerInteractions', href: '/crm', permission: 'crm:view' },
      { labelKey: 'nav.ticketSla', href: '/support', permission: 'crm:view' },
      { labelKey: 'nav.loyaltyReport', href: '/reports/loyalty', permission: 'crm:view' },
    ],
  },
  {
    id: 'ecommerce',
    labelKey: 'nav.onlineOrders',
    descKey: 'ecommerceDesc',
    icon: ShoppingBag,
    accent: 'from-teal-500 to-cyan-600',
    hub: '/ecommerce/orders',
    permission: 'ecom:view',
    navKey: 'nav.onlineOrders',
    features: ['/ecommerce', '/courier'],
    reports: [
      { labelKey: 'nav.fulfilmentReport', href: '/ecommerce/orders', permission: 'ecom:view' },
      { labelKey: 'nav.codReconciliation', href: '/courier', permission: 'ecom:view' },
    ],
  },
  {
    id: 'distribution',
    labelKey: 'nav.distribution',
    descKey: 'distributionDesc',
    icon: MapPinned,
    accent: 'from-sky-500 to-blue-600',
    hub: '/distribution',
    permission: 'sr:view',
    navKey: 'nav.distribution',
    features: ['/distribution', '/distribution/routes'],
    reports: [{ labelKey: 'nav.srPerformance', href: '/distribution', permission: 'sr:view' }],
  },
  {
    id: 'importExport',
    labelKey: 'nav.importExport',
    descKey: 'importExportDesc',
    icon: Ship,
    accent: 'from-blue-500 to-indigo-600',
    hub: '/import-export',
    permission: 'procurement:view',
    navKey: 'nav.importExport',
    features: ['/import-export'],
    reports: [{ labelKey: 'nav.lcStatus', href: '/import-export', permission: 'procurement:view' }],
  },
  {
    id: 'approvals',
    labelKey: 'nav.approvals',
    descKey: 'approvalsDesc',
    icon: CheckSquare,
    accent: 'from-amber-500 to-orange-600',
    hub: '/approvals',
    navKey: 'nav.approvals',
    features: ['/approvals', '/projects'],
    reports: [
      { labelKey: 'nav.pendingApprovals', href: '/approvals' },
      { labelKey: 'nav.projectPnl', href: '/projects' },
    ],
  },
  {
    id: 'reports',
    labelKey: 'reports.title',
    descKey: 'reports.subtitle',
    icon: BarChart3,
    accent: 'from-indigo-500 to-purple-600',
    hub: '/reports',
    permission: 'reports:dashboard',
    features: ['/reports', '/scheduled-reports'],
    reports: [
      { labelKey: 'nav.allReports', href: '/reports', permission: 'reports:dashboard' },
      { labelKey: 'nav.scheduledReports', href: '/scheduled-reports', permission: 'reports:export' },
    ],
  },
  {
    id: 'admin',
    labelKey: 'landing.administration',
    descKey: 'adminDesc',
    icon: Shield,
    accent: 'from-slate-500 to-slate-700',
    hub: '/users',
    permission: 'users:manage',
    features: ['/organizations', '/users', '/roles', '/audit-logs', '/backup'],
    reports: [{ labelKey: 'nav.auditTrail', href: '/audit-logs', permission: 'audit:view' }],
  },
];

/** Route prefixes per module: its features plus its reports. */
const MODULE_MATCH: Record<string, string[]> = Object.fromEntries(
  MODULE_DEFS.map((m) => [m.id, [...m.features, ...m.reports.map((r) => r.href)]])
);

/** Entries that stay visible in every module. */
export const GLOBAL_ROUTES = ['/dashboard', '/settings'];

export function routeInModule(href: string | undefined, module: ModuleDef): boolean {
  if (!href) return false;
  return (MODULE_MATCH[module.id] || []).some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

/** The longest matching prefix wins, so /reports/sales belongs to Trade, not Reports. */
export function resolveModule(pathname: string): ModuleDef | undefined {
  let best: ModuleDef | undefined;
  let bestLength = -1;
  for (const module of MODULE_DEFS) {
    for (const prefix of MODULE_MATCH[module.id] || []) {
      if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && prefix.length > bestLength) {
        best = module;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

export function moduleById(id: string): ModuleDef | undefined {
  return MODULE_DEFS.find((m) => m.id === id);
}

/**
 * Which module a nav entry belongs to — used to colour a sidebar heading with
 * its own module's accent instead of leaving every heading looking the same.
 */
export function moduleForNavEntry(labelKey: string, href?: string): ModuleDef | undefined {
  const byNavKey = MODULE_DEFS.find((m) => m.navKey === labelKey);
  if (byNavKey) return byNavKey;
  if (!href) return undefined;
  return MODULE_DEFS.find((m) => routeInModule(href, m));
}
