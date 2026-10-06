'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { useBranding } from '../hooks/useBranding';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Bookmark,
  Warehouse,
  Barcode,
  Truck,
  Receipt,
  Users,
  Building2,
  Clock,
  CreditCard,
  Landmark,
  BarChart3,
  UserCog,
  Shield,
  ScrollText,
  Settings,
  Database,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Store,
  X,
  Plus,
  Calculator,
  CalendarCheck,
  MapPinned,
  Route as RouteIcon,
  Factory,
  Heart,
  ShoppingBag,
  Layers,
  Ship,
  CheckSquare,
  FolderKanban,
  CalendarClock,
  Target,
  LifeBuoy,
  CalendarOff,
  PackageCheck,
  XCircle,
  BadgePercent,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SOFTWARE_CREDIT } from '../lib/constants';
import { useI18n } from '../lib/i18n';
import { MODULE_DEFS, moduleForNavEntry, resolveModule, routeInModule, type ModuleDef } from '../lib/modules';

interface SubNavItem {
  /** i18n key, e.g. "nav.dashboard" — translated at render time. */
  labelKey: string;
  href: string;
  /** Module heading inside the dropdown — set on the first item of a block. */
  section?: string;
  permission?: string;
  icon?: React.ElementType;
  /** Posting to the books stays with the owner — hidden from other admins. */
  superAdminOnly?: boolean;
}

interface NavItem {
  /** i18n key, e.g. "nav.dashboard" — translated at render time. */
  labelKey: string;
  icon: React.ElementType;
  href?: string;
  permission?: string;
  /** Platform-level item — only the Super Admin sees it. */
  superAdminOnly?: boolean;
  subItems?: SubNavItem[];
}

const navItems: NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    permission: 'reports:dashboard',
  },
  {
    labelKey: 'nav.tradeInventory',
    icon: Warehouse,
    permission: 'inv:view',
    subItems: [
      { labelKey: 'nav.tradeDashboard', href: '/trade', icon: LayoutDashboard },
      { labelKey: 'nav.posTerminal', section: 'nav.sectionSmartPos', href: '/pos', icon: ShoppingCart, permission: 'pos:checkout' },
      { labelKey: 'nav.shifts', href: '/shifts', icon: Clock, permission: 'shifts:operate' },
      { labelKey: 'nav.salesHistory', section: 'nav.sectionSales', href: '/sales', icon: Receipt, permission: 'sales:view' },
      { labelKey: 'nav.mySales', href: '/my-sales', icon: Receipt },
      { labelKey: 'nav.customers', href: '/customers', icon: Users, permission: 'customers:view' },
      { labelKey: 'nav.purchaseOrders', section: 'nav.sectionPurchase', href: '/purchase-orders', icon: Truck, permission: 'procurement:view' },
      { labelKey: 'nav.purchaseReceive', href: '/purchase-orders/receive', icon: PackageCheck, permission: 'procurement:receive' },
      { labelKey: 'nav.purchaseReturns', href: '/purchase-orders/returns', icon: XCircle, permission: 'procurement:view' },
      { labelKey: 'nav.suppliers', href: '/suppliers', icon: Building2, permission: 'procurement:view' },
      { labelKey: 'nav.inventory', section: 'nav.sectionInventory', href: '/inventory', icon: Warehouse, permission: 'inv:view' },
      { labelKey: 'nav.allProducts', href: '/products', icon: Package, permission: 'inv:view' },
      { labelKey: 'nav.wholesalePriceList', href: '/products/wholesale-price-list', icon: Tags, permission: 'inv:view' },
      { labelKey: 'nav.categories', href: '/categories', icon: Tags, permission: 'inv:view' },
      { labelKey: 'nav.productGroups', href: '/product-groups', icon: Layers, permission: 'inv:view' },
      { labelKey: 'nav.brands', href: '/brands', icon: Bookmark, permission: 'inv:view' },
      { labelKey: 'nav.stockTransfers', href: '/stock-transfers', icon: Truck, permission: 'inv:view' },
      { labelKey: 'nav.incomingStock', href: '/stock-transfers', icon: PackageCheck, permission: 'inv:view' },
      { labelKey: 'nav.chainDashboard', href: '/chain-management', icon: Building2, permission: 'reports:dashboard' },
      { labelKey: 'nav.barcodeLabels', href: '/barcode-labels', icon: Barcode, permission: 'inv:labels' },
      { labelKey: 'nav.priceTiers', section: 'nav.sectionWholesale', href: '/price-tiers', icon: Tags, permission: 'customers:view' },
      { labelKey: 'nav.volumePricing', href: '/price-tiers/volume-pricing', icon: BadgePercent, permission: 'pricing:manage' },
    ],
  },
  {
    labelKey: 'nav.importExport',
    icon: Ship,
    href: '/import-export',
    permission: 'procurement:view',
  },
  {
    labelKey: 'nav.approvals',
    icon: CheckSquare,
    href: '/approvals',
  },
  {
    labelKey: 'nav.projects',
    icon: FolderKanban,
    href: '/projects',
  },
  {
    labelKey: 'nav.scheduledReports',
    icon: CalendarClock,
    href: '/scheduled-reports',
    permission: 'reports:export',
  },
  {
    labelKey: 'nav.onlineOrders',
    icon: ShoppingBag,
    permission: 'ecom:view',
    subItems: [
      { labelKey: 'nav.orders', href: '/ecommerce/orders', icon: ShoppingBag, permission: 'ecom:view' },
      { labelKey: 'nav.courierDelivery', href: '/courier', icon: Truck, permission: 'ecom:view' },
    ],
  },
  {
    labelKey: 'nav.leads',
    icon: Target,
    href: '/leads',
    permission: 'crm:view',
  },
  {
    labelKey: 'nav.supportTickets',
    icon: LifeBuoy,
    href: '/support',
    permission: 'crm:view',
  },
  {
    labelKey: 'nav.leaveRequests',
    icon: CalendarOff,
    href: '/hr/leave',
    permission: 'hr:view',
  },
  {
    labelKey: 'nav.distribution',
    icon: MapPinned,
    permission: 'sr:view',
    subItems: [
      { labelKey: 'nav.overview', href: '/distribution', icon: MapPinned, permission: 'sr:view' },
      { labelKey: 'nav.routesTerritories', href: '/distribution/routes', icon: RouteIcon, permission: 'distribution:manage' },
    ],
  },
  {
    labelKey: 'nav.hrPayroll',
    icon: CalendarCheck,
    href: '/hr',
    permission: 'hr:view',
  },
  {
    labelKey: 'nav.production',
    icon: Factory,
    href: '/production',
    permission: 'production:view',
  },
  {
    labelKey: 'nav.crm',
    icon: Heart,
    href: '/crm',
    permission: 'crm:view',
  },
  {
    labelKey: 'nav.expenses',
    icon: CreditCard,
    href: '/expenses',
    permission: 'expenses:view',
  },
  {
    labelKey: 'nav.accounts',
    icon: Landmark,
    permission: 'accounts:view',
    subItems: [
      { labelKey: 'nav.walletsBalances', href: '/accounts', icon: Landmark, permission: 'accounts:view' },
      { labelKey: 'nav.chartOfAccounts', href: '/accounts/chart', icon: Bookmark, permission: 'accounts:view' },
      { labelKey: 'nav.dayBook', href: '/accounts/journal', icon: ScrollText, permission: 'accounts:view' },
      { labelKey: 'nav.openingBalances', href: '/accounts/opening-balances', icon: Calculator, permission: 'accounts:view', superAdminOnly: true },
      { labelKey: 'nav.yearEndClosing', href: '/accounts/year-close', icon: CalendarCheck, permission: 'accounts:view', superAdminOnly: true },
      { labelKey: 'nav.newJournalVoucher', href: '/accounts/journal/new', icon: Plus, permission: 'accounts:manage', superAdminOnly: true },
    ],
  },
  {
    /**
     * Not the owner of any report any more — every module carries its own
     * reports. This is the cross-module index for analysts and admins.
     */
    labelKey: 'nav.allReports',
    icon: BarChart3,
    href: '/reports',
    permission: 'reports:dashboard',
  },
  {
    labelKey: 'nav.organizations',
    icon: Building2,
    href: '/organizations',
    superAdminOnly: true,
  },
  {
    labelKey: 'nav.plans',
    icon: Layers,
    href: '/plans',
    superAdminOnly: true,
  },
  {
    labelKey: 'nav.users',
    icon: UserCog,
    href: '/users',
    permission: 'users:manage',
  },
  {
    labelKey: 'nav.roles',
    icon: Shield,
    href: '/roles',
    permission: 'roles:view',
  },
  {
    labelKey: 'nav.auditLogs',
    icon: ScrollText,
    href: '/audit-logs',
    permission: 'audit:view',
  },
  {
    labelKey: 'nav.backup',
    icon: Database,
    href: '/backup',
    permission: 'settings:manage',
  },
  {
    labelKey: 'nav.settings',
    icon: Settings,
    href: '/settings',
    permission: 'settings:manage',
  },
];

/**
 * ── Contextual navigation ─────────────────────────────────────────────────
 *
 * The list above is the "home" menu. Every module (see lib/modules.ts) owns its
 * features *and* its reports — `buildHomeNav` folds each module's reports into
 * that module's own dropdown, so reporting lives inside the module it belongs
 * to instead of in one central "Reports" pile.
 *
 * Inside a module we then show only that module's entries plus the globals, and
 * `resolveModule` always picks the *longest* matching prefix, so /reports/sales
 * is Trade's report while /reports itself is the cross-module reporting centre.
 */
const GLOBAL_NAV: NavItem[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard', permission: 'reports:dashboard' },
  { labelKey: 'nav.settings', icon: Settings, href: '/settings', permission: 'settings:manage' },
];

/**
 * Home menu with each module's reports attached to that module. A module whose
 * page is a single entry (CRM, HR, Distribution…) becomes a group so it has
 * somewhere to keep its reports: the module page first, then its reporting.
 */
function buildHomeNav(): NavItem[] {
  const byNavKey = new Map<string, ModuleDef>();
  MODULE_DEFS.forEach((mod) => {
    if (mod.navKey) byNavKey.set(mod.navKey, mod);
  });

  return navItems.map((item) => {
    const module = byNavKey.get(item.labelKey);
    if (!module || module.reports.length === 0) return item;

    const reports: SubNavItem[] = module.reports.map((report, index) => ({
      labelKey: report.labelKey,
      href: report.href,
      permission: report.permission,
      section: index === 0 ? 'nav.reportsSection' : undefined,
    }));

    if (item.subItems) {
      return { ...item, subItems: [...item.subItems, ...reports] };
    }

    return {
      ...item,
      href: undefined,
      subItems: [
        { labelKey: 'nav.overview', href: item.href!, icon: item.icon, permission: item.permission },
        ...reports,
      ],
    };
  });
}

const homeNav: NavItem[] = buildHomeNav();

/**
 * The coloured square that marks a section heading.
 *
 * Headings used to look exactly like their own sub-items; giving each one its
 * module's accent (or a neutral chip for non-module entries) is what makes the
 * menu readable at a glance.
 */
const HeadingChip = ({
  icon: ChipIcon,
  module,
  active,
}: {
  icon: React.ElementType;
  module?: ModuleDef;
  active?: boolean;
}) => (
  <span
    className={cn(
      'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all',
      module ? `bg-gradient-to-br ${module.accent} shadow-sm` : 'bg-slate-800 border border-slate-700',
      active && 'ring-2 ring-blue-500/50'
    )}
  >
    <ChipIcon className={cn('w-3.5 h-3.5', module ? 'text-white' : 'text-slate-300')} />
  </span>
);


interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onClose,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const branding = useBranding();
  const { t } = useI18n();
  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});
  const toggleSubmenu = (label: string) => {
    setExpandedSubmenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const canAccess = (permission?: string) => {
    if (!permission || !user) return true;
    if (user.role === 'SUPER_ADMIN' || user.isPlatformSuperAdmin) return true;
    return user.permissions.includes(permission);
  };

  const activeModule = resolveModule(pathname || '');

  /**
   * Where the menu comes from. Inside a module only that module's routes
   * survive (groups keep just their own children), then the global entries are
   * appended so Dashboard and Settings never disappear.
   */
  const sourceNav: NavItem[] = React.useMemo(() => {
    if (!activeModule) return homeNav;
    const scoped = homeNav
      .map((item) => {
        if (item.subItems) {
          return { ...item, subItems: item.subItems.filter((sub) => routeInModule(sub.href, activeModule)) };
        }
        return routeInModule(item.href, activeModule) ? item : null;
      })
      .filter((item): item is NavItem => {
        if (!item) return false;
        return item.subItems ? item.subItems.length > 0 : true;
      });

    // Global entries (Dashboard, Settings) always stay, without duplicates
    const already = new Set<string>();
    for (const item of scoped) {
      if (item.href) already.add(item.href);
      (item.subItems || []).forEach((sub) => already.add(sub.href));
    }
    const globals = GLOBAL_NAV.filter((g) => !already.has(g.href || ''));
    return [...scoped, ...globals];
  }, [activeModule]);

  const filteredNav = sourceNav.filter((item) => {
    if (item.superAdminOnly && !user?.isPlatformSuperAdmin) return false;
    if (item.subItems) {
      return item.subItems.some((sub) => canAccess(sub.permission));
    }
    return canAccess(item.permission);
  });

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-slate-900 border-r border-slate-800 z-50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl',
          isCollapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header / Brand */}
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-4 border-b border-slate-800 min-h-[65px]',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.shopName}
                className="w-8 h-8 rounded-xl object-cover shrink-0 shadow-lg ring-2 ring-blue-500/20 bg-white"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20 ring-2 ring-blue-500/20">
                <Store className="w-4 h-4 text-white" />
              </div>
            )}
            {!isCollapsed && (
              <div className="overflow-hidden leading-tight">
                <p className="font-bold text-white text-sm truncate">{branding.shopName || 'Smart Retail POS'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                  {user?.role ? user.role.replace('_', ' ') : 'Enterprise'}
                </p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          {!isCollapsed && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 lg:hidden transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-none">
          {/* Which module am I in? — with a way back to the full menu */}
          {activeModule && !isCollapsed && (
            <div className="mb-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0',
                    activeModule.accent
                  )}
                >
                  <activeModule.icon className="w-3.5 h-3.5 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{t('nav.currentModule')}</p>
                  <p className="text-xs font-bold text-white truncate">{t(activeModule.labelKey)}</p>
                </div>
              </div>
              <Link
                href="/modules"
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> {t('nav.allModules')}
              </Link>
            </div>
          )}

          {activeModule && isCollapsed && (
            <Link
              href="/modules"
              onClick={onClose}
              title={t('nav.allModules')}
              className="flex items-center justify-center p-2 mb-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
          )}

          {filteredNav.map((item) => {
            const Icon = item.icon;
            // Which module this heading belongs to — its accent colours the chip.
            const headingModule = moduleForNavEntry(item.labelKey, item.href);

            // Handle submenu items
            if (item.subItems) {
              const allowedSubItems = item.subItems.filter(
                (sub) => canAccess(sub.permission) && (!sub.superAdminOnly || user?.role === 'SUPER_ADMIN' || user?.isPlatformSuperAdmin)
              );
              if (allowedSubItems.length === 0) return null;

              const isSubActive = allowedSubItems.some(
                (sub) => pathname === sub.href || (sub.href !== '/reports' && pathname.startsWith(sub.href))
              );
              // Inside a module the groups open by default — the user came here
              // to see this module's pages, not to hunt for them.
              const isExpanded = expandedSubmenus[item.labelKey] ?? !!activeModule;

              if (isCollapsed) {
                // In collapsed mode, click takes to first subitem or shows popover
                const firstSub = allowedSubItems[0];
                return (
                  <Link
                    key={item.labelKey}
                    href={firstSub.href}
                    title={t(item.labelKey)}
                    className={cn(
                      'flex items-center justify-center p-3 rounded-xl transition-all group relative',
                      isSubActive
                        ? 'bg-blue-600/20 text-blue-400 border-l-4 border-blue-500'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    )}
                  >
                    <Icon className={cn('w-5 h-5 shrink-0', isSubActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200')} />
                  </Link>
                );
              }

              return (
                <div key={item.labelKey} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSubmenu(item.labelKey)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-xl transition-all duration-150 group text-left',
                      // A heading, not a link: bolder, with its own surface so it
                      // never reads as one more sub-item.
                      isSubActive
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-800/40 text-slate-100 hover:bg-slate-800/70 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <HeadingChip icon={Icon} module={headingModule} active={isSubActive} />
                      <span className="text-[13px] font-bold truncate">{t(item.labelKey)}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200',
                        isExpanded && 'rotate-180 text-blue-400'
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="pl-3 pr-1 py-1 space-y-0.5 ml-[22px] border-l border-slate-800 max-h-[70vh] overflow-y-auto scrollbar-none">
                      {allowedSubItems.map((sub, index) => {
                        const isChildActive = pathname === sub.href;
                        // A new module block starts a labelled section
                        const startsSection = !!sub.section && allowedSubItems[index - 1]?.section !== sub.section;
                        return (
                          <React.Fragment key={`${sub.href}-${sub.labelKey}`}>
                            {startsSection && (
                              <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t(sub.section!)}
                              </p>
                            )}
                            <Link
                              href={sub.href}
                              onClick={onClose}
                              className={cn(
                                'block px-3 py-2 text-xs rounded-lg transition-all',
                                isChildActive
                                  ? 'bg-blue-600/20 text-blue-400 font-semibold border-l-2 border-blue-500 pl-2.5'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                              )}
                            >
                              {t(sub.labelKey)}
                            </Link>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular single nav item
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : (item.href ? pathname.startsWith(item.href) : false);

            return (
              <Link
                key={item.labelKey}
                href={item.href || '#'}
                onClick={onClose}
                title={isCollapsed ? t(item.labelKey) : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl transition-all duration-150 group relative',
                  isCollapsed ? 'px-2.5 py-3 justify-center' : 'px-2.5 py-2.5',
                  // Same heading surface as the collapsible groups, so every
                  // top-level entry reads as a section rather than a leaf.
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-800/40 text-slate-100 hover:bg-slate-800/70 hover:text-white'
                )}
              >
                {isCollapsed ? (
                  <Icon
                    className={cn(
                      'shrink-0 transition-colors w-5 h-5',
                      isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  />
                ) : (
                  <>
                    <HeadingChip icon={Icon} module={headingModule} active={isActive} />
                    <span className="text-[13px] font-bold truncate">{t(item.labelKey)}</span>
                  </>
                )}
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Software credit */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Software by{' '}
              <span className="text-slate-400 font-medium">{SOFTWARE_CREDIT.company}</span>
              <br />
              {SOFTWARE_CREDIT.developer} · {SOFTWARE_CREDIT.phone}
            </p>
          </div>
        )}

        {/* Collapse Toggle Footer */}
        <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-800 bg-slate-900/50">
          {!isCollapsed && <span className="text-[11px] text-slate-500 font-medium">Collapse Menu</span>}
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all ml-auto"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
