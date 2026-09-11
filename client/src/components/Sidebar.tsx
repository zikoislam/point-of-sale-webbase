'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, ShoppingCart, Package, Tags, Warehouse,
  Truck, Receipt, Users, Building2, Clock, CreditCard,
  Landmark, BarChart3, UserCog, Shield, Settings,
  ChevronLeft, ChevronRight, Store, X,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',       icon: LayoutDashboard, href: '/dashboard',        permission: 'reports:dashboard' },
  { label: 'POS Terminal',    icon: ShoppingCart,    href: '/pos',              permission: 'pos:checkout' },
  { label: 'Products',        icon: Package,         href: '/products',         permission: 'inv:view' },
  { label: 'Categories',      icon: Tags,            href: '/categories',       permission: 'inv:view' },
  { label: 'Inventory',       icon: Warehouse,       href: '/inventory',        permission: 'inv:view' },
  { label: 'Purchase Orders', icon: Truck,           href: '/purchase-orders',  permission: 'procurement:view' },
  { label: 'Sales History',   icon: Receipt,         href: '/sales',            permission: 'sales:view' },
  { label: 'Customers',       icon: Users,           href: '/customers',        permission: 'customers:view' },
  { label: 'Suppliers',       icon: Building2,       href: '/suppliers',        permission: 'procurement:view' },
  { label: 'Shifts',          icon: Clock,           href: '/shifts',           permission: 'shifts:operate' },
  { label: 'Expenses',        icon: CreditCard,      href: '/expenses',         permission: 'expenses:view' },
  { label: 'Accounts',        icon: Landmark,        href: '/accounts',         permission: 'accounts:view' },
  { label: 'Reports',         icon: BarChart3,       href: '/reports',          permission: 'reports:dashboard' },
  { label: 'Users',           icon: UserCog,         href: '/users',            permission: 'users:manage' },
  { label: 'Roles',           icon: Shield,          href: '/roles',            permission: 'roles:view' },
  { label: 'Audit Logs',      icon: Shield,          href: '/audit-logs',       permission: 'audit:view' },
  { label: 'Settings',        icon: Settings,        href: '/settings',         permission: 'settings:manage' },
];

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, isCollapsed, onToggleCollapse, onClose }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const canAccess = (permission?: string) => {
    if (!permission || !user) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions.includes(permission);
  };

  const filteredNav = navItems.filter((item) => canAccess(item.permission));

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-slate-900 border-r border-slate-800 z-50
          flex flex-col transition-all duration-300 ease-in-out shadow-2xl
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo & Brand */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-800 min-h-[65px] ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
            <Store className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-white text-sm leading-tight truncate">Smart Retail POS</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.role.replace('_', ' ')}</p>
            </div>
          )}
          {/* Mobile Close */}
          {!isCollapsed && (
            <button
              onClick={onClose}
              className="ml-auto text-slate-400 hover:text-white lg:hidden transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={isCollapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 rounded-xl transition-all duration-150 group
                  ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-200'}`} />
                {!isCollapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle (desktop) */}
        <div className="hidden lg:flex items-center justify-end p-3 border-t border-slate-800">
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
