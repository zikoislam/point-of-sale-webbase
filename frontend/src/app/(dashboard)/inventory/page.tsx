'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  Boxes,
  AlertTriangle,
  Flame,
  Search,
  Plus,
  Layers,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Check,
  X,
  History,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  'Content-Type': 'application/json',
});
const fetchOpts = (opts: RequestInit = {}): RequestInit => ({
  ...opts,
  credentials: 'include' as RequestCredentials,
  headers: { ...authHeader(), ...(opts.headers as Record<string, string> || {}) },
});

interface Variant {
  _id: string;
  sku: string;
  attributeName: string;
  costPrice: number;
  currentStock: number;
  alertQty: number;
}

interface Product {
  id: string;
  name: string;
  categoryName?: string;
  unit: string;
  variants: Variant[];
}

interface WastageRecord {
  _id: string;
  productId: { name: string; unit: string };
  quantity: number;
  unitCost: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string;
  userId?: { name: string };
  createdAt: string;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const canViewCost = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_MANAGER';
  const canAdjust = user?.role === 'SUPER_ADMIN' || (user?.permissions || []).includes('inv:adjust');
  const [activeTab, setActiveTab] = useState<'STOCK' | 'WASTAGE'>('STOCK');
  const [products, setProducts] = useState<Product[]>([]);
  const [wastages, setWastages] = useState<WastageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Wastage Modal
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [wastageQty, setWastageQty] = useState(1);
  const [wastageReason, setWastageReason] = useState('Expired / Damaged');
  const [wastageSaving, setWastageSaving] = useState(false);
  const [wastageError, setWastageError] = useState('');

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch(`${API}/products?limit=100`, fetchOpts());
      const j = await res.json();
      if (j.success) {
        const fullProds: Product[] = [];
        for (const p of j.data || []) {
          const det = await fetch(`${API}/products/${p.id}`, fetchOpts());
          const dj = await det.json();
          if (dj.success && dj.data) fullProds.push(dj.data);
        }
        setProducts(fullProds);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchWastages = useCallback(async () => {
    try {
      const res = await fetch(`${API}/inventory/wastage?limit=50`, fetchOpts());
      const j = await res.json();
      if (j.success) setWastages(j.data.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCatalog(), fetchWastages()]);
    setLoading(false);
  }, [fetchCatalog, fetchWastages]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Flattened variants for modal & stock calculation
  const allVariants: {
    variantId: string;
    productName: string;
    attributeName: string;
    sku: string;
    unit: string;
    costPrice: number;
    currentStock: number;
    alertQty: number;
  }[] = [];

  let totalValuation = 0;
  let lowStockCount = 0;

  for (const p of products) {
    for (const v of p.variants) {
      allVariants.push({
        variantId: v._id,
        productName: p.name,
        attributeName: v.attributeName,
        sku: v.sku,
        unit: p.unit,
        costPrice: v.costPrice || 0,
        currentStock: v.currentStock || 0,
        alertQty: v.alertQty || 5,
      });

      totalValuation += (v.currentStock || 0) * (v.costPrice || 0);
      if ((v.currentStock || 0) <= (v.alertQty || 5)) lowStockCount++;
    }
  }

  const openWastageModal = (variantId?: string) => {
    setSelectedVariantId(variantId || allVariants[0]?.variantId || '');
    setWastageQty(1);
    setWastageReason('Expired / Damaged');
    setWastageError('');
    setShowWastageModal(true);
  };

  const handleRecordWastage = async () => {
    if (!selectedVariantId) {
      setWastageError('Please select a product variant');
      return;
    }
    if (wastageQty <= 0) {
      setWastageError('Quantity must be greater than 0');
      return;
    }
    if (!wastageReason.trim()) {
      setWastageError('Please specify reason for damage/wastage');
      return;
    }

    setWastageSaving(true);
    setWastageError('');

    try {
      const res = await fetch(`${API}/inventory/wastage`, fetchOpts({
        method: 'POST',
        body: JSON.stringify({
          variantId: selectedVariantId,
          quantity: Number(wastageQty),
          reason: wastageReason.trim(),
        }),
      }));

      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message || j.message || 'Failed to record wastage');

      setShowWastageModal(false);
      refreshAll();
    } catch (e: any) {
      setWastageError(e.message);
    } finally {
      setWastageSaving(false);
    }
  };

  const activeSelectedVariant = allVariants.find((v) => v.variantId === selectedVariantId);
  const projectedLoss = (wastageQty || 0) * (activeSelectedVariant?.costPrice || 0);

  const filteredVariants = allVariants.filter(
    (v) =>
      v.productName.toLowerCase().includes(search.toLowerCase()) ||
      v.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Inventory Valuation & Wastage</h1>
            <p className="text-sm text-slate-400">
              Real-time on-hand inventory valuation, reorder thresholds & write-off damage losses
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refreshAll}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openWastageModal()}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-lg shadow-rose-600/20"
          >
            <Flame className="w-4 h-4" />
            <span>Record Wastage / Damage</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400 uppercase font-semibold">Total Inventory Valuation</div>
          <div className="text-2xl font-black text-emerald-400">
            {canViewCost ? `৳${totalValuation.toFixed(2)}` : '—'}
          </div>
          <p className="text-[11px] text-slate-500">Based on Weighted Average Cost (WAC)</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400 uppercase font-semibold">Low Stock Threshold Warnings</div>
          <div className="text-2xl font-black text-amber-400">{lowStockCount} items</div>
          <p className="text-[11px] text-slate-500">Stock count below alert threshold</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400 uppercase font-semibold">Logged Spoilage / Wastage</div>
          <div className="text-2xl font-black text-rose-400">{wastages.length} incidents</div>
          <p className="text-[11px] text-slate-500">Auto-booked as operating expense</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'STOCK'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>On-Hand Stock Valuation</span>
        </button>
        <button
          onClick={() => setActiveTab('WASTAGE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'WASTAGE'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Wastage Audit History ({wastages.length})</span>
        </button>
      </div>

      {/* Tab 1: On Hand Stock */}
      {activeTab === 'STOCK' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                    <th className="py-3.5 px-4">Item & Variant</th>
                    <th className="py-3.5 px-4">SKU</th>
                    <th className="py-3.5 px-4 text-right">Cost Price (WAC)</th>
                    <th className="py-3.5 px-4 text-center">Stock Level</th>
                    <th className="py-3.5 px-4 text-right">Total Asset Value</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                        Loading stock valuation...
                      </td>
                    </tr>
                  ) : filteredVariants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No product variants found.
                      </td>
                    </tr>
                  ) : (
                    filteredVariants.map((v) => (
                      <tr key={v.variantId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{v.productName}</div>
                          <div className="text-xs text-slate-400">{v.attributeName}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{v.sku}</td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                          {canViewCost ? `৳${(v.costPrice || 0).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              v.currentStock <= v.alertQty
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {v.currentStock} {v.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                          {canViewCost ? `৳${(v.currentStock * (v.costPrice || 0)).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {canAdjust ? (
                            <button
                              onClick={() => openWastageModal(v.variantId)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-600/30 transition flex items-center space-x-1 ml-auto"
                            >
                              <Flame className="w-3 h-3" />
                              <span>Write-off</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wastage History */}
      {activeTab === 'WASTAGE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4 text-center">Discarded Qty</th>
                  <th className="py-3.5 px-4 text-right">Unit Valuation</th>
                  <th className="py-3.5 px-4 text-right">Total Loss Amount</th>
                  <th className="py-3.5 px-4">Reason / Notes</th>
                  <th className="py-3.5 px-4">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {wastages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No wastage records found.
                    </td>
                  </tr>
                ) : (
                  wastages.map((w) => (
                    <tr key={w._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {new Date(w.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {w.productId?.name || 'Product'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-rose-400">
                        -{w.quantity} {w.productId?.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-300">
                        ৳{w.unitCost?.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-rose-400">
                        ৳{(w.quantity * (w.unitCost || 0)).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {w.reason || 'Damaged'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {w.userId?.name || 'Admin'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Wastage Modal */}
      {showWastageModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-white">Record Inventory Wastage</h2>
              </div>
              <button
                onClick={() => setShowWastageModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {wastageError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {wastageError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Product Variant *
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                >
                  {allVariants.map((v) => (
                    <option key={v.variantId} value={v.variantId}>
                      {v.productName} ({v.attributeName}) • Stock: {v.currentStock} {v.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Wastage / Discard Quantity *
                </label>
                <input
                  type="number"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(Number(e.target.value))}
                  min={1}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-base focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Condition *
                </label>
                <input
                  type="text"
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}
                  placeholder="e.g. Expired batch, bottle leakage, transit damage"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Loss calculation card */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Booked Loss:</span>
                <span className="text-base font-black text-rose-400">
                  ৳{projectedLoss.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowWastageModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordWastage}
                disabled={wastageSaving || wastageQty <= 0}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20"
              >
                {wastageSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Write-off & Book Loss</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
