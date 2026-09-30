'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BadgePercent,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Calculator,
  Pencil,
  Save,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';

interface TierRow {
  minQty: number;
  maxQty: string; // kept as string so the field can be empty (open-ended)
  discountPercent: number;
  fixedPrice: string; // empty = not used
}

interface VolumeRule {
  _id: string;
  productId: any;
  variantId?: string | null;
  customerType: 'RETAIL' | 'WHOLESALE' | 'ALL';
  tiers: Array<{ minQty: number; maxQty?: number | null; discountPercent: number; fixedPrice?: number | null }>;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
  notes?: string;
}

interface ProductOption {
  id: string;
  name: string;
  variants?: Array<{ _id: string; sku: string; attributeName: string; retailSellingPrice: number; wholesaleSellingPrice: number }>;
}

const money = (v: number) => `৳${(v || 0).toFixed(2)}`;

const emptyTier = (): TierRow => ({ minQty: 1, maxQty: '', discountPercent: 0, fixedPrice: '' });

export default function VolumePricingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // product picker
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [showResults, setShowResults] = useState(false);

  // form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<'RETAIL' | 'WHOLESALE' | 'ALL'>('ALL');
  const [tiers, setTiers] = useState<TierRow[]>([emptyTier()]);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // preview calculator
  const [previewQty, setPreviewQty] = useState(10);
  const [previewBasePrice, setPreviewBasePrice] = useState(100);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['volume-pricing-products', debounced],
    queryFn: async () => {
      if (debounced.length < 2) return [];
      const res = await api.get(`/products?search=${encodeURIComponent(debounced)}&limit=10`);
      const rows = Array.isArray(res.data) ? res.data : res.data?.products || res.data?.data || [];
      return rows;
    },
    enabled: debounced.length >= 2,
  });

  const { data: rules = [], isLoading: rulesLoading, refetch, isRefetching } = useQuery<VolumeRule[]>({
    queryKey: ['volume-pricing-rules', selectedProduct?.id],
    queryFn: async () => {
      const res = await api.get('/volume-pricing', {
        params: selectedProduct?.id ? { productId: selectedProduct.id } : undefined,
      } as any);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setCustomerType('ALL');
    setTiers([emptyTier()]);
    setValidFrom('');
    setValidTo('');
    setIsActive(true);
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (rule: VolumeRule) => {
    setEditingId(rule._id);
    setCustomerType(rule.customerType);
    setTiers(
      (rule.tiers || []).map((t) => ({
        minQty: t.minQty,
        maxQty: t.maxQty === null || t.maxQty === undefined ? '' : String(t.maxQty),
        discountPercent: t.discountPercent || 0,
        fixedPrice: t.fixedPrice === null || t.fixedPrice === undefined ? '' : String(t.fixedPrice),
      }))
    );
    setValidFrom(rule.validFrom ? String(rule.validFrom).slice(0, 10) : '');
    setValidTo(rule.validTo ? String(rule.validTo).slice(0, 10) : '');
    setIsActive(rule.isActive);
    setNotes(rule.notes || '');
    setSelectedProduct(
      typeof rule.productId === 'object' && rule.productId
        ? { id: rule.productId._id || rule.productId.id, name: rule.productId.name }
        : selectedProduct
    );
    setModalOpen(true);
  };

  const saveRule = async () => {
    if (!selectedProduct) {
      toast.error('Pick a product first');
      return;
    }
    if (tiers.every((t) => !(t.minQty >= 0))) {
      toast.error('Add at least one quantity tier');
      return;
    }
    setSaving(true);
    const payload = {
      productId: selectedProduct.id,
      variantId: selectedVariantId || null,
      customerType,
      tiers: tiers.map((t) => ({
        minQty: Number(t.minQty) || 0,
        maxQty: t.maxQty === '' ? null : Number(t.maxQty),
        discountPercent: Number(t.discountPercent) || 0,
        fixedPrice: t.fixedPrice === '' ? null : Number(t.fixedPrice),
      })),
      validFrom: validFrom || null,
      validTo: validTo || null,
      isActive,
      notes: notes || undefined,
    };
    try {
      if (editingId) {
        await api.put(`/volume-pricing/${editingId}`, payload);
        toast.success('Volume pricing updated');
      } else {
        await api.post('/volume-pricing', payload);
        toast.success('Volume pricing created');
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['volume-pricing-rules'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this volume pricing rule?')) return;
    try {
      await api.delete(`/volume-pricing/${id}`);
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['volume-pricing-rules'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── live preview: which tier's price applies at a given quantity ──────────
  const preview = useMemo(() => {
    const sorted = [...tiers].sort((a, b) => Number(a.minQty) - Number(b.minQty));
    const match = sorted
      .filter((t) => {
        const min = Number(t.minQty) || 0;
        const max = t.maxQty === '' ? Infinity : Number(t.maxQty);
        return previewQty >= min && previewQty <= max;
      })
      .sort((a, b) => Number(b.minQty) - Number(a.minQty))[0];

    if (!match) return { price: previewBasePrice, label: 'No volume tier for this quantity' };
    const fixed = match.fixedPrice === '' ? null : Number(match.fixedPrice);
    if (fixed !== null) return { price: fixed, label: `Fixed band price (${money(fixed)})` };
    const disc = Number(match.discountPercent) || 0;
    return {
      price: Math.round(previewBasePrice * (1 - disc / 100) * 100) / 100,
      label: `${disc}% off the base price`,
    };
  }, [tiers, previewQty, previewBasePrice]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <BadgePercent className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Volume / Trade Pricing</h1>
            <p className="text-sm text-slate-400">
              Quantity bands that discount (or fix) the unit price — applied automatically at POS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={openCreate} disabled={!selectedProduct}>
            New Rule
          </Button>
        </div>
      </div>

      {/* Product picker */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Product
        </label>
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={selectedProduct ? selectedProduct.name : search}
            onChange={(e) => {
              setSelectedProduct(null);
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search a product by name, SKU or barcode…"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {showResults && !selectedProduct && products.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProduct(p);
                    setSelectedVariantId('');
                    setShowResults(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800 text-sm text-slate-200 border-b border-slate-800 last:border-0"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedProduct && (
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Badge variant="success" size="sm">Selected: {selectedProduct.name}</Badge>
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            >
              <option value="">All variants (product-wide rule)</option>
              {(selectedProduct.variants || []).map((v) => (
                <option key={v._id} value={v._id}>
                  {v.attributeName} · {v.sku}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Existing rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {selectedProduct ? `Rules for ${selectedProduct.name}` : 'All volume pricing rules'}
          </span>
          <span className="text-xs text-slate-500">{rules.length} rule(s)</span>
        </div>
        {rulesLoading ? (
          <div className="p-10 text-center text-slate-500 text-sm">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            No rules yet — pick a product and create the first quantity band.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {rules.map((rule) => (
              <div key={rule._id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {typeof rule.productId === 'object' ? rule.productId?.name : 'Product'}
                    {rule.variantId ? <span className="text-slate-500"> · variant-specific</span> : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant={rule.customerType === 'ALL' ? 'info' : 'purple'} size="sm">
                      {rule.customerType}
                    </Badge>
                    {rule.tiers.map((t, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                        {t.minQty}
                        {t.maxQty === null || t.maxQty === undefined ? '+' : `–${t.maxQty}`}
                        {t.fixedPrice !== null && t.fixedPrice !== undefined
                          ? ` → ${money(t.fixedPrice)}`
                          : ` → −${t.discountPercent}%`}
                      </span>
                    ))}
                    <Badge variant={rule.isActive ? 'success' : 'danger'} size="sm">
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"
                    title="Edit"
                    onClick={() => openEdit(rule)}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                    title="Delete"
                    onClick={() => deleteRule(rule._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Volume Pricing' : 'New Volume Pricing'}
        subtitle={selectedProduct?.name}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Customer type</label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as any)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="ALL">All customers</option>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Valid from</label>
              <Input type="date" value={validFrom} onChange={(e: any) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Valid to</label>
              <Input type="date" value={validTo} onChange={(e: any) => setValidTo(e.target.value)} />
            </div>
          </div>

          {/* Tier editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Quantity tiers
              </label>
              <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setTiers([...tiers, emptyTier()])}>
                Add tier
              </Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-slate-500 font-bold px-1">
                <span className="col-span-3">Min qty</span>
                <span className="col-span-3">Max qty</span>
                <span className="col-span-2">Discount %</span>
                <span className="col-span-3">Fixed price</span>
                <span className="col-span-1" />
              </div>
              {tiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    value={tier.minQty}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...tier, minQty: Number(e.target.value) };
                      setTiers(next);
                    }}
                    className="col-span-3 h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="open"
                    value={tier.maxQty}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...tier, maxQty: e.target.value };
                      setTiers(next);
                    }}
                    className="col-span-3 h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.discountPercent}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...tier, discountPercent: Number(e.target.value) };
                      setTiers(next);
                    }}
                    className="col-span-2 h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="off"
                    value={tier.fixedPrice}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...tier, fixedPrice: e.target.value };
                      setTiers(next);
                    }}
                    className="col-span-3 h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600"
                  />
                  <button
                    type="button"
                    className="col-span-1 p-2 text-rose-400 hover:bg-slate-800 rounded-lg"
                    onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}
                    disabled={tiers.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Max qty খালি রাখলে ওই band উপরে open-ended থাকে। Fixed price দিলে discount % উপেক্ষা হয়।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Notes (optional)" value={notes} onChange={(e: any) => setNotes(e.target.value)} />
            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="accent-emerald-500" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>

          {/* Preview calculator */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Pricing preview</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Base unit price (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={previewBasePrice}
                  onChange={(e) => setPreviewBasePrice(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min={0}
                  value={previewQty}
                  onChange={(e) => setPreviewQty(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5">
              <span className="text-xs text-slate-400">{preview.label}</span>
              <span className="text-base font-black text-emerald-400">{money(preview.price)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} leftIcon={<Save className="w-4 h-4" />} onClick={saveRule}>
              {editingId ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
