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
} from 'lucide-react';
import { api } from '../lib/api-client';

interface SearchResult {
  type: 'product' | 'sale' | 'customer' | 'supplier' | 'purchase-order';
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
  product: { label: 'Product', icon: Package, color: 'text-emerald-400' },
  sale: { label: 'Sale', icon: Receipt, color: 'text-blue-400' },
  customer: { label: 'Customer', icon: Users, color: 'text-amber-400' },
  supplier: { label: 'Supplier', icon: Truck, color: 'text-violet-400' },
  'purchase-order': { label: 'Purchase Order', icon: FileText, color: 'text-rose-400' },
};

/** Open the palette from anywhere (e.g. the Header search button). */
export function openGlobalSearch() {
  window.dispatchEvent(new Event('pos:open-search'));
}

const OPEN_EVENT = 'pos:open-search';

export const GlobalSearch: React.FC = () => {
  const router = useRouter();
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

  const results = useMemo(() => data || [], [data]);

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
