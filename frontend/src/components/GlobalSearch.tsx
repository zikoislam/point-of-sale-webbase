'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Package,
  Receipt,
  Users,
  Truck,
  FileText,
  CornerDownLeft,
  Loader2,
  Compass,
  Building2,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';

interface SearchResult {
  type: 'product' | 'sale' | 'customer' | 'supplier' | 'purchase-order' | 'organization' | 'page';
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

const TYPE_META: Record<
  SearchResult['type'],
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  page: { label: 'Go to', icon: Compass, color: 'text-cyan-400' },
  organization: { label: 'Organization', icon: Building2, color: 'text-rose-400' },
  product: { label: 'Product', icon: Package, color: 'text-emerald-400' },
  sale: { label: 'Sale', icon: Receipt, color: 'text-blue-400' },
  customer: { label: 'Customer', icon: Users, color: 'text-amber-400' },
  supplier: { label: 'Supplier', icon: Truck, color: 'text-violet-400' },
  'purchase-order': { label: 'Purchase Order', icon: FileText, color: 'text-fuchsia-400' },
};

interface Command {
  label: string;
  href: string;
  group: string;
  permission?: string;
  superAdminOnly?: boolean;
  keywords?: string[];
}

/** Every page/operation reachable by name — mirrors the sidebar. */
const COMMANDS: Command[] = [
  { label: 'Dashboard', href: '/dashboard', group: 'Overview', permission: 'reports:dashboard', keywords: ['home', 'overview', 'ড্যাশবোর্ড'] },
  { label: 'POS Terminal', href: '/pos', group: 'Sales', permission: 'pos:checkout', keywords: ['sale', 'checkout', 'pos', 'বিক্রয়', 'ক্যাশ'] },
  { label: 'Shifts', href: '/shifts', group: 'Sales', permission: 'shifts:operate', keywords: ['shift'] },
  { label: 'Sales History', href: '/sales', group: 'Sales', permission: 'sales:view', keywords: ['invoice', 'sales', 'বিক্রয়', 'ইনভয়েস'] },
  { label: 'My Sales', href: '/my-sales', group: 'Sales', keywords: ['my sales'] },
  { label: 'Customers', href: '/customers', group: 'Sales', permission: 'customers:view', keywords: ['customer', 'কাস্টমার', 'খদ্দের'] },
  { label: 'Purchase Orders', href: '/purchase-orders', group: 'Purchase', permission: 'procurement:view', keywords: ['po', 'purchase', 'ক্রয়'] },
  { label: 'Purchase Receive', href: '/purchase-orders/receive', group: 'Purchase', permission: 'procurement:receive', keywords: ['receive', 'grn'] },
  { label: 'Purchase Returns', href: '/purchase-orders/returns', group: 'Purchase', permission: 'procurement:view', keywords: ['return'] },
  { label: 'Suppliers', href: '/suppliers', group: 'Purchase', permission: 'procurement:view', keywords: ['supplier', 'vendor', 'সরবরাহকারী'] },
  { label: 'Inventory', href: '/inventory', group: 'Inventory', permission: 'inv:view', keywords: ['stock', 'স্টক'] },
  { label: 'All Products', href: '/products', group: 'Inventory', permission: 'inv:view', keywords: ['product', 'item', 'sku', 'barcode', 'প্রোডাক্ট', 'পণ্য'] },
  { label: 'Wholesale Price List', href: '/products/wholesale-price-list', group: 'Inventory', permission: 'inv:view', keywords: ['wholesale', 'price'] },
  { label: 'Categories', href: '/categories', group: 'Inventory', permission: 'inv:view', keywords: ['category', 'ক্যাটাগরি'] },
  { label: 'Product Groups', href: '/product-groups', group: 'Inventory', permission: 'inv:view', keywords: ['group'] },
  { label: 'Brands', href: '/brands', group: 'Inventory', permission: 'inv:view', keywords: ['brand', 'ব্র্যান্ড'] },
  { label: 'Stock Transfers', href: '/stock-transfers', group: 'Inventory', permission: 'inv:view', keywords: ['transfer'] },
  { label: 'Chain Management', href: '/chain-management', group: 'Inventory', permission: 'reports:dashboard', keywords: ['branch', 'chain'] },
  { label: 'Barcode Labels', href: '/barcode-labels', group: 'Inventory', permission: 'inv:labels', keywords: ['barcode', 'label', 'print', 'বারকোড'] },
  { label: 'Price Tiers', href: '/price-tiers', group: 'Wholesale', permission: 'customers:view', keywords: ['tier', 'price'] },
  { label: 'Volume Pricing', href: '/price-tiers/volume-pricing', group: 'Wholesale', permission: 'pricing:manage', keywords: ['volume'] },
  { label: 'Import / Export', href: '/import-export', group: 'Operations', permission: 'procurement:view', keywords: ['import', 'export', 'lc'] },
  { label: 'Approvals', href: '/approvals', group: 'Operations', keywords: ['approval'] },
  { label: 'Projects', href: '/projects', group: 'Operations', keywords: ['project'] },
  { label: 'Scheduled Reports', href: '/scheduled-reports', group: 'Reports', permission: 'reports:export', keywords: ['schedule'] },
  { label: 'Online Orders', href: '/ecommerce/orders', group: 'eCommerce', permission: 'ecom:view', keywords: ['order', 'online'] },
  { label: 'Courier / Delivery', href: '/courier', group: 'eCommerce', permission: 'ecom:view', keywords: ['courier', 'delivery'] },
  { label: 'Leads', href: '/leads', group: 'CRM', permission: 'crm:view', keywords: ['lead'] },
  { label: 'Support Tickets', href: '/support', group: 'CRM', permission: 'crm:view', keywords: ['ticket', 'support'] },
  { label: 'Leave Requests', href: '/hr/leave', group: 'HR', permission: 'hr:view', keywords: ['leave'] },
  { label: 'HR & Payroll', href: '/hr', group: 'HR', permission: 'hr:view', keywords: ['hr', 'payroll', 'employee'] },
  { label: 'Distribution', href: '/distribution', group: 'Distribution', permission: 'sr:view', keywords: ['distribution', 'sr'] },
  { label: 'Routes & Territories', href: '/distribution/routes', group: 'Distribution', permission: 'distribution:manage', keywords: ['route'] },
  { label: 'Production', href: '/production', group: 'Production', permission: 'production:view', keywords: ['production', 'manufacture'] },
  { label: 'CRM', href: '/crm', group: 'CRM', permission: 'crm:view', keywords: ['crm'] },
  { label: 'Expenses', href: '/expenses', group: 'Finance', permission: 'expenses:view', keywords: ['expense', 'খরচ'] },
  { label: 'Accounts', href: '/accounts', group: 'Finance', permission: 'accounts:view', keywords: ['account', 'wallet', 'balance', 'হিসাব'] },
  { label: 'Chart of Accounts', href: '/accounts/chart', group: 'Finance', permission: 'accounts:view', keywords: ['coa', 'chart'] },
  { label: 'Day Book', href: '/accounts/journal', group: 'Finance', permission: 'accounts:view', keywords: ['journal', 'day book', 'দৈনিক'] },
  { label: 'Opening Balances', href: '/accounts/opening-balances', group: 'Finance', permission: 'accounts:view', superAdminOnly: true, keywords: ['opening'] },
  { label: 'Year-End Closing', href: '/accounts/year-close', group: 'Finance', permission: 'accounts:view', superAdminOnly: true, keywords: ['year close'] },
  { label: 'New Journal Voucher', href: '/accounts/journal/new', group: 'Finance', permission: 'accounts:manage', superAdminOnly: true, keywords: ['voucher', 'journal'] },
  { label: 'All Reports', href: '/reports', group: 'Reports', permission: 'reports:dashboard', keywords: ['report', 'রিপোর্ট'] },
  { label: 'Trial Balance', href: '/reports/trial-balance', group: 'Reports', permission: 'accounts:view', keywords: ['trial balance', 'রেওয়ামিল'] },
  { label: 'Balance Sheet', href: '/reports/balance-sheet', group: 'Reports', permission: 'accounts:view', keywords: ['balance sheet', 'উদ্বৃত্তপত্র'] },
  { label: 'Cash Flow', href: '/reports/cash-flow', group: 'Reports', permission: 'accounts:view', keywords: ['cash flow', 'নগদ প্রবাহ'] },
  { label: 'Organizations', href: '/organizations', group: 'Platform', superAdminOnly: true, keywords: ['organization', 'company', 'shop', 'tenant', 'প্রতিষ্ঠান', 'দোকান'] },
  { label: 'Plans', href: '/plans', group: 'Platform', superAdminOnly: true, keywords: ['plan', 'subscription', 'license', 'প্ল্যান'] },
  { label: 'Users', href: '/users', group: 'Admin', permission: 'users:manage', keywords: ['user', 'staff', 'ব্যবহারকারী'] },
  { label: 'Roles', href: '/roles', group: 'Admin', permission: 'roles:view', keywords: ['role', 'permission', 'রোল'] },
  { label: 'Audit Logs', href: '/audit-logs', group: 'Admin', permission: 'audit:view', keywords: ['audit', 'log'] },
  { label: 'Backup', href: '/backup', group: 'Admin', permission: 'settings:manage', keywords: ['backup', 'ব্যাকআপ'] },
  { label: 'Settings', href: '/settings', group: 'Admin', permission: 'settings:manage', keywords: ['settings', 'config', 'সেটিংস'] },
];

/** Open the palette from anywhere (e.g. the Header search button). */
export function openGlobalSearch() {
  window.dispatchEvent(new Event('pos:open-search'));
}

const OPEN_EVENT = 'pos:open-search';

export const GlobalSearch: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const isSuper = !!user?.isPlatformSuperAdmin;
  const permissions = user?.permissions;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd+K toggles, Esc closes, and the Header button dispatches an open event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Reset + focus whenever the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Debounce the keystrokes so we do not fire a request per character.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 180);
    return () => window.clearTimeout(id);
  }, [query]);

  const enabled = open && debounced.length >= 2;
  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: async () => {
      const res = await api.get('/search', { params: { q: debounced } });
      return (res.data?.results || []) as SearchResult[];
    },
    enabled,
    staleTime: 15_000,
  });

  // Pages/operations match instantly on the client (no round-trip); data
  // results come from the API and are appended after them.
  const commandHits = useMemo<SearchResult[]>(() => {
    if (debounced.length < 2) return [];
    const q = debounced.toLowerCase();
    return COMMANDS.filter((c) => {
      if (c.superAdminOnly && !isSuper) return false;
      if (c.permission && !isSuper && !(permissions || []).includes(c.permission)) return false;
      return (
        c.label.toLowerCase().includes(q) ||
        c.href.toLowerCase().includes(q) ||
        (c.keywords || []).some((k) => k.toLowerCase().includes(q))
      );
    })
      .slice(0, 8)
      .map((c) => ({
        type: 'page' as const,
        id: c.href,
        title: c.label,
        subtitle: c.group,
        badge: 'Page',
        href: c.href,
      }));
  }, [debounced, isSuper, permissions]);

  const results = useMemo<SearchResult[]>(() => [...commandHits, ...(data || [])], [commandHits, data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, results]);

  const go = (result?: SearchResult) => {
    if (!result) return;
    setOpen(false);
    // Tell the products page to prefill even if it is already mounted (the URL
    // query alone only applies on a fresh mount).
    if (result.type === 'product') {
      const token = new URLSearchParams(result.href.split('?')[1] || '').get('search') || '';
      window.dispatchEvent(new CustomEvent('pos:prefill-product-search', { detail: token }));
    }
    router.push(result.href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] px-4 bg-slate-950/70 backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search anything — barcode, SKU, invoice, phone, product, customer…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
          />
          {isFetching && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
          <kbd className="hidden sm:block text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {!enabled ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              Type at least 2 characters — or scan a barcode.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              {isFetching ? 'Searching…' : 'No matches found.'}
            </p>
          ) : (
            results.map((r, index) => {
              const meta = TYPE_META[r.type];
              const Icon = meta.icon;
              const active = index === activeIndex;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  data-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(r)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    active ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white truncate">{r.title}</span>
                    {r.subtitle && <span className="block text-[11px] text-slate-500 truncate">{r.subtitle}</span>}
                  </span>
                  {r.badge && (
                    <span className="hidden sm:inline text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5 max-w-[160px] truncate">
                      {r.badge}
                    </span>
                  )}
                  <span className="hidden sm:inline text-[10px] uppercase tracking-wide text-slate-600">{meta.label}</span>
                  {active && <CornerDownLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500">
          <span className="flex items-center gap-3">
            <span><kbd className="border border-slate-700 rounded px-1">↑</kbd> <kbd className="border border-slate-700 rounded px-1">↓</kbd> navigate</span>
            <span><kbd className="border border-slate-700 rounded px-1">↵</kbd> open</span>
          </span>
          <span>Ctrl + K</span>
        </div>
      </div>
    </div>
  );
};
