'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import '../print.css';

/** Path-prefix → required permission (longest prefix wins). */
const ROUTE_PERMISSIONS: Array<[string, string]> = [
  ['/dashboard', 'reports:dashboard'],
  ['/categories', 'inv:view'],
  ['/brands', 'inv:view'],
  ['/products', 'inv:view'],
  ['/inventory', 'inv:view'],
  ['/barcode-labels', 'inv:labels'],
  ['/purchase-orders', 'procurement:view'],
  ['/suppliers', 'procurement:view'],
  ['/sales', 'sales:view'],
  ['/customers', 'customers:view'],
  ['/shifts', 'shifts:operate'],
  ['/expenses', 'expenses:view'],
  ['/accounts', 'accounts:view'],
  ['/reports', 'reports:dashboard'],
  ['/users', 'users:manage'],
  ['/roles', 'roles:view'],
  ['/audit-logs', 'audit:view'],
  ['/settings', 'settings:manage'],
];

function resolvePermission(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  let best: string | undefined;
  let bestLen = -1;
  for (const [prefix, permission] of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (prefix.length > bestLen) {
        best = permission;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const requiredPermission = resolvePermission(pathname);

  // h-screen stays as the fallback height; where the browser supports dynamic
  // viewport units, 100dvh keeps the bottom of the page clear of the mobile
  // browser chrome instead of hiding it underneath.
  return (
    <ProtectedRoute requiredPermission={requiredPermission}>
      <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-950 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content area */}
        <div
          className={`
            flex flex-col flex-1 min-w-0 transition-all duration-300
            ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
          `}
        >
          <Header
            onMenuClick={() => setSidebarOpen((v) => !v)}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
