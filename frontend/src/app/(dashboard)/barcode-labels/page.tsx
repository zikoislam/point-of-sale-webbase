'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { formatCurrency, cn } from '../../../lib/utils';
import { BarcodeRenderer } from '../../../components/BarcodeRenderer';
import {
  Barcode,
  Printer,
  Settings2,
  RefreshCw,
  Search,
  Check,
  Eye,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface FlatVariant {
  variantId: string;
  productId: string;
  productName: string;
  attributeName: string;
  sku: string;
  barcode: string;
  retailPrice: number;
}

export default function BarcodeLabelsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [copies, setCopies] = useState<number>(24);
  const [shopName, setShopName] = useState('SMART RETAIL POS');
  const [labelFormat, setLabelFormat] = useState<'ROLL_38x25' | 'ROLL_50x30' | 'A4_GRID'>('A4_GRID');

  // Toggle visible elements on label
  const [showShopName, setShowShopName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [showPrice, setShowPrice] = useState(true);

  // Fetch Products catalog with variants
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['barcode-catalog'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 100 } });
      const prods = Array.isArray(res.data?.products) ? res.data.products : (Array.isArray(res.data) ? res.data : []);
      return prods;
    },
  });

  // Extract all variants flat
  const allVariants: FlatVariant[] = useMemo(() => {
    const list: FlatVariant[] = [];
    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          list.push({
            variantId: v._id || v.id || `${p.id}-${v.sku}`,
            productId: p.id || p._id,
            productName: p.name,
            attributeName: v.attributeName || 'Standard',
            sku: v.sku || 'SKU-000',
            barcode: v.barcode || v.sku || '00000000',
            retailPrice: v.retailSellingPrice || v.price || 0,
          });
        }
      } else {
        list.push({
          variantId: p.id || p._id,
          productId: p.id || p._id,
          productName: p.name,
          attributeName: 'Standard',
          sku: p.firstSku || 'SKU-000',
          barcode: p.firstSku || '00000000',
          retailPrice: p.lowestRetailPrice || 0,
        });
      }
    }
    return list;
  }, [products]);

  // Filtered variants for picker
  const filteredVariants = useMemo(() => {
    if (!searchQuery.trim()) return allVariants;
    const q = searchQuery.toLowerCase();
    return allVariants.filter(
      (v) =>
        v.productName.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.barcode.toLowerCase().includes(q)
    );
  }, [allVariants, searchQuery]);

  // Set default selection
  React.useEffect(() => {
    if (!selectedVariantId && allVariants.length > 0) {
      setSelectedVariantId(allVariants[0].variantId);
    }
  }, [allVariants, selectedVariantId]);

  const activeVariant = allVariants.find((v) => v.variantId === selectedVariantId) || allVariants[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header - Hidden when printing */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Barcode Label Generator
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Print shelf sticker tags & barcode labels for thermal printers or A4 label sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh catalog"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
            disabled={!activeVariant}
          >
            Print {copies} Labels
          </Button>
        </div>
      </div>

      {/* Configuration & Variant Picker Grid - Hidden when printing */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Variant Selection (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col h-[480px]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Select Product Variant
          </h2>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product or SKU..."
              className="w-full h-8 pl-8 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-800/40">
            {filteredVariants.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No matching variants found
              </div>
            ) : (
              filteredVariants.map((v) => {
                const isSelected = v.variantId === selectedVariantId;
                return (
                  <button
                    key={v.variantId}
                    type="button"
                    onClick={() => setSelectedVariantId(v.variantId)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2',
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate">{v.productName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {v.attributeName} · <span className="font-mono">{v.sku}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-400">
                        {formatCurrency(v.retailPrice)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Label Settings & Toggles (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-400" />
            <span>Label Configuration</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Header / Shop Name</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Number of Sticker Copies</label>
              <input
                type="number"
                min="1"
                max="240"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Label Paper Format</label>
              <select
                value={labelFormat}
                onChange={(e) => setLabelFormat(e.target.value as any)}
                className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="A4_GRID">A4 Grid Sheet (24 Labels / sheet)</option>
                <option value="ROLL_50x30">Thermal Roll (50mm × 30mm)</option>
                <option value="ROLL_38x25">Thermal Roll (38mm × 25mm)</option>
              </select>
            </div>
          </div>

          {/* Visible Elements Toggles */}
          <div className="border-t border-slate-800 pt-4">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Elements Included on Label
            </span>
            <div className="flex flex-wrap gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Shop Header</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showProductName}
                  onChange={(e) => setShowProductName(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Product & Variant Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSku}
                  onChange={(e) => setShowSku(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>SKU</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showBarcodeText}
                  onChange={(e) => setShowBarcodeText(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Barcode Digits</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>MRP Selling Price</span>
              </label>
            </div>
          </div>

          {/* Quick Single Preview */}
          <div className="border-t border-slate-800 pt-4">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Single Sticker Live Preview
            </span>
            <div className="inline-block p-4 bg-white text-black rounded-lg border shadow-sm text-center min-w-[200px] max-w-[260px]">
              {showShopName && (
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                  {shopName}
                </p>
              )}
              {showProductName && (
                <p className="text-xs font-bold leading-tight line-clamp-1 mt-0.5 text-black">
                  {activeVariant?.productName} ({activeVariant?.attributeName})
                </p>
              )}

              {/* Barcode Graphic */}
              <div className="flex justify-center my-1.5">
                <BarcodeRenderer
                  value={activeVariant?.barcode || activeVariant?.sku || '00000000'}
                  height={labelFormat === 'ROLL_38x25' ? 24 : 34}
                  width={labelFormat === 'ROLL_38x25' ? 1.1 : 1.3}
                />
              </div>

              {(showBarcodeText || showSku) && (
                <p className="font-mono text-[9px] tracking-widest text-slate-700">
                  {activeVariant?.barcode || activeVariant?.sku}
                </p>
              )}

              {showPrice && (
                <p className="text-xs font-black text-black mt-1">
                  MRP: {formatCurrency(activeVariant?.retailPrice)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* Printable Sheet Area (Visible on screen and print) */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl text-black">
        <div className="print:hidden flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Print Sheet Layout ({labelFormat})
            </h3>
            <p className="text-xs text-slate-500">
              Previewing {copies} stickers. Click "Print {copies} Labels" to print.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-3.5 h-3.5" />}>
            Print Now
          </Button>
        </div>

        {/* Layout Grid */}
        <div
          className={cn(
            'grid gap-3 select-none',
            labelFormat === 'ROLL_38x25' && 'grid-cols-2 sm:grid-cols-3 max-w-md mx-auto',
            labelFormat === 'ROLL_50x30' && 'grid-cols-1 sm:grid-cols-2 max-w-sm mx-auto',
            labelFormat === 'A4_GRID' && 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          )}
        >
          {Array.from({ length: copies }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'p-2.5 border border-dashed border-slate-300 rounded-lg text-center flex flex-col items-center justify-between bg-white text-black',
                labelFormat === 'ROLL_38x25' ? 'min-h-[100px]' : 'min-h-[130px]'
              )}
            >
              {showShopName && (
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-800">
                  {shopName}
                </p>
              )}

              {showProductName && (
                <p className="text-[11px] font-bold leading-tight line-clamp-1 mt-0.5 text-black">
                  {activeVariant?.productName}
                </p>
              )}

              <p className="text-[9px] text-slate-600 leading-none">
                {activeVariant?.attributeName}
              </p>

              {/* Real SVG Barcode */}
              <div className="flex justify-center my-1">
                <BarcodeRenderer
                  value={activeVariant?.barcode || activeVariant?.sku || '00000000'}
                  height={labelFormat === 'ROLL_38x25' ? 24 : 32}
                  width={labelFormat === 'ROLL_38x25' ? 1.0 : 1.25}
                />
              </div>

              {(showBarcodeText || showSku) && (
                <p className="font-mono text-[9px] tracking-wider text-slate-700 leading-none">
                  {activeVariant?.barcode || activeVariant?.sku}
                </p>
              )}

              {showPrice && (
                <p className="text-[11px] font-black text-black mt-0.5">
                  MRP: {formatCurrency(activeVariant?.retailPrice)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
