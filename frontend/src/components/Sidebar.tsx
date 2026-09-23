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
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SOFTWARE_CREDIT } from '../lib/constants';

interface SubNavItem {
  label: string;
  href: string;
  permission?: string;
  icon?: React.ElementType;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  permission?: string;
  subItems?: SubNavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    permission: 'reports:dashboard',
  },
  {
    label: 'POS Terminal',
    icon: ShoppingCart,
    href: '/pos',
    permission: 'pos:checkout',
  },
  {
    label: 'Products',
    icon: Package,
    permission: 'inv:view',
    subItems: [
      { label: 'All Products', href: '/products', icon: Package, permission: 'inv:view' },
      { label: 'Categories', href: '/categories', icon: Tags, permission: 'inv:view' },
      { label: 'Brands', href: '/brands', icon: Bookmark, permission: 'inv:view' },
      { label: 'Inventory', href: '/inventory', icon: Warehouse, permission: 'inv:view' },
      { label: 'Barcode Labels', href: '/barcode-labels', icon: Barcode, permission: 'inv:labels' },
    ],
  },
  {
    label: 'Purchase Orders',
    icon: Truck,
    href: '/purchase-orders',
    permission: 'procurement:view',
  },
  {
    label: 'Sales History',
    icon: Receipt,
    href: '/sales',
    permission: 'sales:view',
  },
  {
    label: 'Customers',
    icon: Users,
    href: '/customers',
    permission: 'customers:view',
  },
  {
    label: 'Suppliers',
    icon: Building2,
    href: '/suppliers',
    permission: 'procurement:view',
  },
  {
    label: 'Shifts',
    icon: Clock,
    href: '/shifts',
    permission: 'shifts:operate',
  },
  {
    label: 'Expenses',
    icon: CreditCard,
    href: '/expenses',
    permission: 'expenses:view',
  },
  {
    label: 'Accounts',
    icon: Landmark,
    permission: 'accounts:view',
    subItems: [
      { label: 'Wallets & Balances', href: '/accounts', icon: Landmark, permission: 'accounts:view' },
      { label: 'Chart of Accounts', href: '/accounts/chart', icon: Bookmark, permission: 'accounts:view' },
      { label: 'Day Book', href: '/accounts/journal', icon: ScrollText, permission: 'accounts:view' },
      { label: 'New Journal Voucher', href: '/accounts/journal/new', icon: Plus, permission: 'accounts:manage' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    permission: 'reports:dashboard',
    subItems: [
      { label: 'Reports Hub', href: '/reports', permission: 'reports:dashboard' },
      { label: 'Sales Report', href: '/reports/sales', permission: 'reports:dashboard' },
      { label: 'Inventory Valuation', href: '/reports/inventory', permission: 'reports:dashboard' },
      { label: 'Profit & Loss (P&L)', href: '/reports/pnl', permission: 'reports:dashboard' },
      { label: 'Customer Due Aging', href: '/reports/customer-aging', permission: 'reports:dashboard' },
      { label: 'Supplier Payable', href: '/reports/supplier-payable', permission: 'reports:dashboard' },
      { label: 'Purchases Summary', href: '/reports/purchases', permission: 'reports:dashboard' },
      { label: 'Wastage Report', href: '/reports/wastage', permission: 'reports:dashboard' },
      { label: 'Trial Balance', href: '/reports/trial-balance', permission: 'accounts:view' },
      { label: 'Balance Sheet', href: '/reports/balance-sheet', permission: 'accounts:view' },
      { label: 'Cash Flow', href: '/reports/cash-flow', permission: 'accounts:view' },
    ],
  },
  {
    label: 'Users',
    icon: UserCog,
    href: '/users',
    permission: 'users:manage',
  },
  {
    label: 'Roles',
    icon: Shield,
    href: '/roles',
    permission: 'roles:view',
  },
  {
    label: 'Audit Logs',
    icon: ScrollText,
    href: '/audit-logs',
    permission: 'audit:view',
  },
  {
    label: 'Backup',
    icon: Database,
    href: '/backup',
    permission: 'settings:manage',
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    permission: 'settings:manage',
  },
];

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
  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({
    Products: true,
    Reports: false,
  });

  const toggleSubmenu = (label: string) => {
    setExpandedSubmenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const canAccess = (permission?: string) => {
    if (!permission || !user) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions.includes(permission);
  };

  const filteredNav = navItems.filter((item) => {
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
          {filteredNav.map((item) => {
            const Icon = item.icon;

            // Handle submenu items
            if (item.subItems) {
              const allowedSubItems = item.subItems.filter((sub) => canAccess(sub.permission));
              if (allowedSubItems.length === 0) return null;

              const isSubActive = allowedSubItems.some(
                (sub) => pathname === sub.href || (sub.href !== '/reports' && pathname.startsWith(sub.href))
              );
              const isExpanded = expandedSubmenus[item.label] ?? false;

              if (isCollapsed) {
                // In collapsed mode, click takes to first subitem or shows popover
                const firstSub = allowedSubItems[0];
                return (
                  <Link
                    key={item.label}
                    href={firstSub.href}
                    title={item.label}
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
                <div key={item.label} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSubmenu(item.label)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 group text-left',
                      isSubActive
                        ? 'bg-slate-800/60 text-slate-100 font-medium'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('w-4 h-4 shrink-0', isSubActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200')} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200',
                        isExpanded && 'rotate-180 text-blue-400'
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="pl-9 pr-1 py-1 space-y-0.5">
                      {allowedSubItems.map((sub) => {
                        const isChildActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onClose}
                            className={cn(
                              'block px-3 py-2 text-xs rounded-lg transition-all',
                              isChildActive
                                ? 'bg-blue-600/20 text-blue-400 font-semibold border-l-2 border-blue-500 pl-2.5'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            )}
                          >
                            {sub.label}
                          </Link>
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
                key={item.label}
                href={item.href || '#'}
                onClick={onClose}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl transition-all duration-150 group relative',
                  isCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border-l-4 border-blue-500 font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                )}
              >
                <Icon
                  className={cn(
                    'shrink-0 transition-colors',
                    isCollapsed ? 'w-5 h-5' : 'w-4 h-4',
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                {!isCollapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
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
