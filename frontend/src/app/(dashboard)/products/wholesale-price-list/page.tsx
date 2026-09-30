'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, FileDown, RefreshCw, Tags, Search } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { useBranding } from '../../../../hooks/useBranding';

/**
 * Wholesale price list — the printable trade catalogue an SR hands to a dealer.
 * Grouped by category, showing the price a trade account actually pays next to
 * the retail price for comparison.
 */
interface PriceRow {
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  unit: string;
  retailPrice: number | null;
  wholesalePrice: number;
  stock: number;
}

interface PriceGroup {
  category: string;
  rows: PriceRow[];
}

interface PriceListResponse {
  summary: { categories: number; items: number };
  data: PriceGroup[];
}

export default function WholesalePriceListPage() {
  const branding = useBranding();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery<PriceListResponse>({
    queryKey: ['wholesale-price-list'],
    queryFn: async () => (await api.get('/products/wholesale-price-list')).data,
  });

  const cur = branding.currencySymbol || '৳';
  const money = (n: number | null) => (n === null || n === undefined ? '—' : `${cur}${n.toFixed(2)}`);

  const term = search.trim().toLowerCase();
  const groups = (data?.data || [])
    .map((g) => ({
      ...g,
      rows: term
        ? g.rows.filter(
            (r) =>
              r.productName.toLowerCase().includes(term) ||
              r.sku.toLowerCase().includes(term) ||
              r.variantName.toLowerCase().includes(term)
          )
        : g.rows,
    }))
    .filter((g) => g.rows.length > 0);

  const shown = groups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <div className="space-y-4 pb-16">
      {/* Toolbar */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center">
            <Tags className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Wholesale Price List</h1>
            <p className="text-xs text-slate-400">
              {data?.summary.categories ?? 0} categories · {shown} item(s) shown
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter product or SKU…"
              className="pl-9 pr-3 py-2 w-56 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="primary"
            leftIcon={<FileDown className="w-4 h-4" />}
            onClick={() => window.open('/api/v1/products/wholesale-price-list/pdf', '_blank')}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="bg-white text-slate-900 mx-auto w-full max-w-[210mm] p-10 shadow-2xl rounded-lg print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            {branding.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={branding.shopName} className="w-14 h-14 object-contain mb-2" />
            )}
            <h2 className="text-xl font-black tracking-tight">{branding.shopName}</h2>
            {branding.shopAddress && <p className="text-[11px] text-slate-600 mt-1">{branding.shopAddress}</p>}
            {branding.shopPhone && <p className="text-[11px] text-slate-600">Phone: {branding.shopPhone}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-black tracking-wide">WHOLESALE PRICE LIST</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {data?.summary.items ?? 0} item(s) · {data?.summary.categories ?? 0} categor(y/ies)
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Issued: {new Date().toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Building the catalogue…
          </div>
        ) : groups.length === 0 ? (
          <p className="py-16 text-center text-slate-500 text-sm">No products to list.</p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className="mt-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
                {group.category}
              </h3>
              <table className="w-full mt-2 text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-2 px-2 text-left font-bold">Product</th>
                    <th className="py-2 px-2 text-left font-bold">SKU</th>
                    <th className="py-2 px-2 text-left font-bold">Unit</th>
                    <th className="py-2 px-2 text-right font-bold">Stock</th>
                    <th className="py-2 px-2 text-right font-bold">Retail</th>
                    <th className="py-2 px-2 text-right font-bold">Wholesale</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.sku || row.productId + row.variantName} className="border-b border-slate-200">
                      <td className="py-1.5 px-2">
                        <span className="font-semibold">{row.productName}</span>
                        {row.variantName && <span className="text-[10px] text-slate-500"> · {row.variantName}</span>}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600">{row.sku || '—'}</td>
                      <td className="py-1.5 px-2 text-slate-600">{row.unit || '—'}</td>
                      <td className="py-1.5 px-2 text-right text-slate-500">{row.stock}</td>
                      <td className="py-1.5 px-2 text-right text-slate-400 line-through">{money(row.retailPrice)}</td>
                      <td className="py-1.5 px-2 text-right font-black">{money(row.wholesalePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <p className="text-[10px] text-slate-500 mt-8 leading-relaxed">
          Wholesale prices apply to trade (WHOLESALE / DEALER) accounts. Prices are exclusive of VAT unless stated and
          are subject to change without notice.
        </p>
        <p className="text-[9px] text-slate-400 mt-4 text-center">{branding.shopName} — Wholesale price list</p>
      </div>
    </div>
  );
}
