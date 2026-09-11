'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  AlertTriangle,
  Barcode,
  Layers,
  DollarSign,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface VariantInput {
  attributeName: string;
  sku: string;
  barcode?: string;
  costPrice: number;
  retailSellingPrice: number;
  wholesaleSellingPrice: number;
  currentStock: number;
  alertQty: number;
}

interface ProductItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  unit: string;
  taxType: string;
  taxRate: number;
  isActive: boolean;
  variantCount: number;
  totalStock: number;
  lowestRetailPrice: number;
  lowestCostPrice?: number;
  createdAt: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface BrandOption {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formTaxType, setFormTaxType] = useState<'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT'>('INCLUSIVE');
  const [formTaxRate, setFormTaxRate] = useState(0);
  const [variants, setVariants] = useState<VariantInput[]>([
    {
      attributeName: 'Standard',
      sku: '',
      barcode: '',
      costPrice: 0,
      retailSellingPrice: 0,
      wholesaleSellingPrice: 0,
      currentStock: 0,
      alertQty: 5,
    },
  ]);

  const fetchDropdowns = async () => {
    try {
      const [cRes, bRes] = await Promise.all([
        fetch(`${API}/categories`, { headers: authHeader() }),
        fetch(`${API}/brands`, { headers: authHeader() }),
      ]);
      const [cJson, bJson] = await Promise.all([cRes.json(), bRes.json()]);
      if (cJson.success) setCategories(cJson.data.map((c: any) => ({ id: c.id, name: c.name })));
      if (bJson.success) setBrands(bJson.data.map((b: any) => ({ id: b.id, name: b.name })));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search ? { search } : {}),
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
        ...(brandFilter ? { brandId: brandFilter } : {}),
        ...(lowStockFilter ? { lowStock: 'true' } : {}),
      });
      const res = await fetch(`${API}/products?${params.toString()}`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        setProducts(j.data.products || []);
        setTotal(j.data.total || 0);
        setTotalPages(j.data.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, brandFilter, lowStockFilter]);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreateModal = () => {
    setEditId(null);
    setFormName('');
    setFormDescription('');
    setFormCategory(categories[0]?.id || '');
    setFormBrand('');
    setFormUnit('Pcs');
    setFormTaxType('INCLUSIVE');
    setFormTaxRate(0);
    setVariants([
      {
        attributeName: 'Standard',
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        barcode: '',
        costPrice: 0,
        retailSellingPrice: 0,
        wholesaleSellingPrice: 0,
        currentStock: 0,
        alertQty: 5,
      },
    ]);
    setError('');
    setShowModal(true);
  };

  const addVariantRow = () => {
    setVariants([
      ...variants,
      {
        attributeName: '',
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        barcode: '',
        costPrice: 0,
        retailSellingPrice: 0,
        wholesaleSellingPrice: 0,
        currentStock: 0,
        alertQty: 5,
      },
    ]);
  };

  const removeVariantRow = (index: number) => {
    if (variants.length <= 1) return;
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariantRow = (index: number, field: keyof VariantInput, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('Product name is required');
      return;
    }
    if (!formCategory) {
      setError('Please select a category');
      return;
    }
    for (const v of variants) {
      if (!v.attributeName.trim()) {
        setError('All variants must have an Attribute / Variant Name');
        return;
      }
      if (!v.sku.trim()) {
        setError('All variants must have an SKU');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        categoryId: formCategory,
        brandId: formBrand || undefined,
        unit: formUnit,
        taxType: formTaxType,
        taxRate: Number(formTaxRate) || 0,
        variants: variants.map((v) => ({
          attributeName: v.attributeName.trim(),
          sku: v.sku.trim().toUpperCase(),
          barcode: v.barcode?.trim() || undefined,
          costPrice: Number(v.costPrice) || 0,
          retailSellingPrice: Number(v.retailSellingPrice) || 0,
          wholesaleSellingPrice: Number(v.wholesaleSellingPrice) || 0,
          currentStock: Number(v.currentStock) || 0,
          alertQty: Number(v.alertQty) || 0,
          unit: formUnit,
        })),
      };

      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to save product');

      setShowModal(false);
      fetchProducts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: authHeader() });
      const j = await res.json();
      if (j.success) fetchProducts();
      else alert(j.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Product Catalog</h1>
            <p className="text-sm text-slate-400">Manage all items, multi-attribute variants & pricing tiers</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchProducts()}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
              lowStockFilter
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Low Stock Alert</span>
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">Category & Brand</th>
                <th className="py-3.5 px-4">Unit</th>
                <th className="py-3.5 px-4">Variants</th>
                <th className="py-3.5 px-4 text-right">Selling Price</th>
                <th className="py-3.5 px-4 text-right">Cost Price</th>
                <th className="py-3.5 px-4 text-center">Stock</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">VAT: {p.taxType} ({p.taxRate}%)</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700 text-slate-300 mr-1.5">
                        {p.categoryName || 'General'}
                      </span>
                      {p.brandName && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                          {p.brandName}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{p.unit}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        <span>{p.variantCount} variant{p.variantCount > 1 ? 's' : ''}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-emerald-400">
                      ৳{p.lowestRetailPrice?.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {p.lowestCostPrice !== undefined ? `৳${p.lowestCostPrice.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.totalStock <= 5
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {p.totalStock} {p.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-medium">{products.length}</span> of{' '}
            <span className="text-white font-medium">{total}</span> items
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
            >
              Previous
            </button>
            <span className="px-2 font-medium text-white">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Package className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white">Create New Product & Variants</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                  {error}
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Pran Mango Juice"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Brand</label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No Brand (Generic)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Measurement Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {['Pcs', 'Kg', 'Gram', 'Ltr', 'Ml', 'Box', 'Meter', 'Goj'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">VAT / Tax Type</label>
                  <select
                    value={formTaxType}
                    onChange={(e) => setFormTaxType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="INCLUSIVE">Tax Inclusive (MRP includes VAT)</option>
                    <option value="EXCLUSIVE">Tax Exclusive (Added at checkout)</option>
                    <option value="EXEMPT">Tax Exempt (0% VAT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">VAT Rate (%)</label>
                  <input
                    type="number"
                    value={formTaxRate}
                    onChange={(e) => setFormTaxRate(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Variants Section */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>Product Variants & Multi-Pricing</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure sizes, colors, retail & wholesale selling tiers, and starting stock.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Variant</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {variants.map((v, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 relative"
                    >
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
                          className="absolute right-3 top-3 text-slate-500 hover:text-rose-400 p-1 rounded"
                          title="Remove variant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Variant / Attribute Name *
                          </label>
                          <input
                            type="text"
                            value={v.attributeName}
                            onChange={(e) => updateVariantRow(idx, 'attributeName', e.target.value)}
                            placeholder="e.g. 500ml / Red / XL"
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">SKU *</label>
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => updateVariantRow(idx, 'sku', e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs uppercase focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Barcode (EAN-13 / Code-128)
                          </label>
                          <input
                            type="text"
                            value={v.barcode || ''}
                            onChange={(e) => updateVariantRow(idx, 'barcode', e.target.value)}
                            placeholder="Scan or type barcode"
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Cost Price (৳)
                          </label>
                          <input
                            type="number"
                            value={v.costPrice}
                            onChange={(e) => updateVariantRow(idx, 'costPrice', e.target.value)}
                            min={0}
                            step="0.01"
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-emerald-400 mb-1">
                            Retail Price (৳) *
                          </label>
                          <input
                            type="number"
                            value={v.retailSellingPrice}
                            onChange={(e) => updateVariantRow(idx, 'retailSellingPrice', e.target.value)}
                            min={0}
                            step="0.01"
                            className="w-full px-3 py-1.5 bg-slate-800 border border-emerald-500/50 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Wholesale Price (৳)
                          </label>
                          <input
                            type="number"
                            value={v.wholesaleSellingPrice}
                            onChange={(e) => updateVariantRow(idx, 'wholesaleSellingPrice', e.target.value)}
                            min={0}
                            step="0.01"
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Initial Stock
                          </label>
                          <input
                            type="number"
                            value={v.currentStock}
                            onChange={(e) => updateVariantRow(idx, 'currentStock', e.target.value)}
                            min={0}
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Alert Qty
                          </label>
                          <input
                            type="number"
                            value={v.alertQty}
                            onChange={(e) => updateVariantRow(idx, 'alertQty', e.target.value)}
                            min={0}
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save Product'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
