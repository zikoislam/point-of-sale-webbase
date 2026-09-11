'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Barcode,
  Printer,
  Copy,
  Layers,
  Settings2,
  RefreshCw,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface Variant {
  _id: string;
  sku: string;
  barcode?: string;
  attributeName: string;
  retailSellingPrice: number;
}

interface Product {
  id: string;
  name: string;
  variants: Variant[];
}

export default function BarcodeLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form selections
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [shopName, setShopName] = useState('SUPER POS MART');
  const [copies, setCopies] = useState<number>(12);
  const [labelSize, setLabelSize] = useState<'ROLL_50x30' | 'A4_SHEET'>('A4_SHEET');

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/products?limit=100`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        const fullProds: Product[] = [];
        for (const p of j.data.products || []) {
          const det = await fetch(`${API}/products/${p.id}`, { headers: authHeader() });
          const dj = await det.json();
          if (dj.success && dj.data) fullProds.push(dj.data);
        }
        setProducts(fullProds);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const allVariants: {
    variantId: string;
    productName: string;
    attributeName: string;
    sku: string;
    barcode: string;
    price: number;
  }[] = [];

  for (const p of products) {
    for (const v of p.variants) {
      allVariants.push({
        variantId: v._id,
        productName: p.name,
        attributeName: v.attributeName,
        sku: v.sku,
        barcode: v.barcode || v.sku,
        price: v.retailSellingPrice || 0,
      });
    }
  }

  useEffect(() => {
    if (!selectedVariantId && allVariants.length > 0) {
      setSelectedVariantId(allVariants[0].variantId);
    }
  }, [allVariants, selectedVariantId]);

  const activeVariant = allVariants.find((v) => v.variantId === selectedVariantId);

  // SVG Barcode Line generator simulation
  const renderBarcodeLines = (code: string) => {
    const bars = [];
    const seed = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    for (let i = 0; i < 48; i++) {
      const isThick = ((seed * (i + 3)) % 7) > 3;
      bars.push(
        <span
          key={i}
          className={`h-9 inline-block ${isThick ? 'w-1 bg-black' : 'w-0.5 bg-black'}`}
        />
      );
    }
    return bars;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header - Hidden on Print */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Barcode & Price Label Generator</h1>
            <p className="text-sm text-slate-400">
              Generate sticker shelf labels with SKU, barcode & retail price for thermal rolls or A4 sheets
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCatalog}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            disabled={!activeVariant}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-cyan-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>Print {copies} Labels</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel - Hidden on Print */}
      <div className="print:hidden p-6 bg-slate-900 border border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Select Product Variant</label>
          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
          >
            {allVariants.map((v) => (
              <option key={v.variantId} value={v.variantId}>
                {v.productName} ({v.attributeName}) • ৳{v.price.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Store / Brand Header</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Number of Sticker Copies</label>
          <input
            type="number"
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
            min={1}
            max={100}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Paper / Printer Layout</label>
          <select
            value={labelSize}
            onChange={(e) => setLabelSize(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
          >
            <option value="A4_SHEET">A4 Sticker Sheet (Grid)</option>
            <option value="ROLL_50x30">Thermal Roll (50mm x 30mm)</option>
          </select>
        </div>
      </div>

      {/* Printable Sheet Area */}
      <div className="bg-white p-6 rounded-2xl shadow-md min-h-[500px]">
        <div
          className={`grid gap-4 ${
            labelSize === 'ROLL_50x30'
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-sm'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}
        >
          {Array.from({ length: copies }).map((_, idx) => (
            <div
              key={idx}
              className="p-3 border-2 border-dashed border-slate-300 rounded-lg text-center flex flex-col items-center justify-between bg-white text-black select-none font-sans"
              style={{ width: '100%', minHeight: '130px' }}
            >
              <div className="text-[10px] font-black tracking-wider uppercase text-slate-700">
                {shopName}
              </div>
              <div className="font-bold text-xs leading-tight line-clamp-1 mt-0.5">
                {activeVariant?.productName || 'Product Name'}
              </div>
              <div className="text-[10px] text-slate-600">
                {activeVariant?.attributeName || 'Variant'}
              </div>

              {/* Barcode Graphic */}
              <div className="flex items-center justify-center space-x-[1.5px] my-1 overflow-hidden">
                {renderBarcodeLines(activeVariant?.barcode || '1234567890')}
              </div>

              <div className="font-mono text-[9px] font-bold tracking-widest text-slate-800">
                {activeVariant?.barcode || activeVariant?.sku || '00000000'}
              </div>

              <div className="text-xs font-black text-black mt-1">
                MRP: ৳{activeVariant?.price?.toFixed(2) || '0.00'} (Incl. VAT)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
