'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Plus, Trash2, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';

export interface ProductVariantForm {
  attributeName: string;
  sku: string;
  barcode?: string;
  costPrice: number;
  retailSellingPrice: number;
  wholesaleSellingPrice: number;
  currentStock: number;
  alertQty: number;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productId?: string | null;
}

const UNIT_OPTIONS = [
  { value: 'Pcs', label: 'Pieces (Pcs)' },
  { value: 'Kg', label: 'Kilogram (Kg)' },
  { value: 'Gram', label: 'Gram (gm)' },
  { value: 'Ltr', label: 'Liter (Ltr)' },
  { value: 'Ml', label: 'Milliliter (Ml)' },
  { value: 'Box', label: 'Box' },
  { value: 'Meter', label: 'Meter (m)' },
  { value: 'Goj', label: 'Goj' },
];

const TAX_TYPE_OPTIONS = [
  { value: 'INCLUSIVE', label: 'Tax Inclusive (MRP includes VAT)' },
  { value: 'EXCLUSIVE', label: 'Tax Exclusive (Added on top at checkout)' },
  { value: 'EXEMPT', label: 'Tax Exempt (0% VAT)' },
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productId,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const isCashier = user?.role === 'CASHIER';

  const [categories, setCategories] = useState<Array<{ value: string; label: string; taxRate?: number }>>([]);
  const [brands, setBrands] = useState<Array<{ value: string; label: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ value: string; label: string }>>([]);

  const [loadingInitial, setLoadingInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Basic Info State
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [taxType, setTaxType] = useState('INCLUSIVE');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [description, setDescription] = useState('');

  // Variants State
  const [variants, setVariants] = useState<ProductVariantForm[]>([
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

  // Load Categories, Brands & Suppliers for dropdowns
  useEffect(() => {
    if (!isOpen) return;

    const loadDropdownData = async () => {
      try {
        const [catRes, brandRes, supRes] = await Promise.all([
          api.get('/categories'),
          api.get('/brands'),
          api.get('/suppliers'),
        ]);

        if (catRes.data) {
          const catList = Array.isArray(catRes.data) ? catRes.data : [];
          setCategories(
            catList.map((c: any) => ({
              value: c.id || c._id,
              label: c.name,
              taxRate: c.defaultTaxRate ?? 0,
            }))
          );
        }

        if (brandRes.data) {
          const bList = Array.isArray(brandRes.data) ? brandRes.data : [];
          setBrands(
            bList.map((b: any) => ({
              value: b.id || b._id,
              label: b.name,
            }))
          );
        }

        if (supRes.data) {
          const sList = Array.isArray(supRes.data) ? supRes.data : [];
          setSuppliers(
            sList.map((s: any) => ({
              value: s.id || s._id,
              label: s.companyName || s.name,
            }))
          );
        }
      } catch (err: any) {
        console.error('Failed to load dropdown data:', err);
      }
    };

    loadDropdownData();
  }, [isOpen]);

  // If editing an existing product, fetch details
  useEffect(() => {
    if (!isOpen) return;

    if (productId) {
      setLoadingInitial(true);
      setError('');
      api
        .get(`/products/${productId}`)
        .then((res) => {
          if (res.data) {
            const p = res.data;
            setName(p.name || '');
            setCategoryId(p.categoryId || '');
            setBrandId(p.brandId || '');
            setSupplierId(p.supplierId || '');
            setUnit(p.unit || 'Pcs');
            setTaxType(p.taxType || 'INCLUSIVE');
            setTaxRate(p.taxRate ?? 0);
            setDescription(p.description || '');

            if (p.variants && p.variants.length > 0) {
              setVariants(
                p.variants.map((v: any) => ({
                  attributeName: v.attributeName || 'Standard',
                  sku: v.sku || '',
                  barcode: v.barcode || '',
                  costPrice: v.costPrice ?? 0,
                  retailSellingPrice: v.retailSellingPrice ?? 0,
                  wholesaleSellingPrice: v.wholesaleSellingPrice ?? 0,
                  currentStock: v.currentStock ?? 0,
                  alertQty: v.alertQty ?? 5,
                }))
              );
            }
          }
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to load product details');
        })
        .finally(() => {
          setLoadingInitial(false);
        });
    } else {
      // Reset to default blank state for new product
      setName('');
      setCategoryId('');
      setBrandId('');
      setSupplierId('');
      setUnit('Pcs');
      setTaxType('INCLUSIVE');
      setTaxRate(0);
      setDescription('');
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
      setLoadingInitial(false);
    }
  }, [isOpen, productId]);

  // Handle category change -> Auto-fill default tax rate
  const handleCategoryChange = (catVal: string | number) => {
    const val = String(catVal);
    setCategoryId(val);
    const selected = categories.find((c) => c.value === val);
    if (selected && selected.taxRate !== undefined) {
      setTaxRate(selected.taxRate);
    }
  };

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
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

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.warning('A product must have at least one variant.');
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: keyof ProductVariantForm, val: any) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    // Validate variants
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.attributeName.trim()) {
        setError(`Variant #${i + 1} is missing an Attribute Name.`);
        return;
      }
      if (!v.sku.trim()) {
        setError(`Variant #${i + 1} is missing an SKU.`);
        return;
      }
      if (v.retailSellingPrice <= 0) {
        setError(`Variant "${v.attributeName}" retail price must be greater than 0.`);
        return;
      }
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      brandId: brandId || undefined,
      supplierId: supplierId || undefined,
      unit,
      taxType,
      taxRate: Number(taxRate) || 0,
      variants: variants.map((v) => ({
        attributeName: v.attributeName.trim(),
        sku: v.sku.trim().toUpperCase(),
        barcode: v.barcode?.trim() || undefined,
        costPrice: Number(v.costPrice) || 0,
        retailSellingPrice: Number(v.retailSellingPrice) || 0,
        wholesaleSellingPrice: Number(v.wholesaleSellingPrice) || 0,
        currentStock: Number(v.currentStock) || 0,
        alertQty: Number(v.alertQty) || 5,
        unit,
      })),
    };

    try {
      if (productId) {
        await api.put(`/products/${productId}`, payload);
        toast.success(`Product "${name}" updated successfully!`);
      } else {
        await api.post('/products', payload);
        toast.success(`Product "${name}" created successfully!`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={productId ? 'Edit Product & Variants' : 'Create New Product'}
      subtitle="Configure product attributes, SKU matrix, pricing tiers and stock limits"
    >
      {loadingInitial ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
          <p className="text-sm">Loading product details...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Product Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
              1. Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Product Name"
                placeholder="e.g. Miniket Rice 5kg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Select
                label="Category"
                placeholder="Select category"
                options={categories}
                value={categoryId}
                onChange={handleCategoryChange}
                searchable
                required
              />

              <Select
                label="Brand (Optional)"
                placeholder="Select brand"
                options={[{ value: '', label: 'No Brand (Generic)' }, ...brands]}
                value={brandId}
                onChange={(val) => setBrandId(String(val))}
                searchable
              />

              <Select
                label="Preferred Supplier"
                placeholder="Select supplier"
                options={[{ value: '', label: 'Select Supplier' }, ...suppliers]}
                value={supplierId}
                onChange={(val) => setSupplierId(String(val))}
                searchable
              />

              <Select
                label="Measurement Unit"
                options={UNIT_OPTIONS}
                value={unit}
                onChange={(val) => setUnit(String(val))}
              />

              <Select
                label="VAT / Tax Type"
                options={TAX_TYPE_OPTIONS}
                value={taxType}
                onChange={(val) => setTaxType(String(val))}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  VAT Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full h-10 px-3.5 bg-slate-900 text-slate-100 text-sm rounded-lg border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional brief description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-10 px-3.5 bg-slate-900 text-slate-100 text-sm rounded-lg border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Product Variants & SKU Matrix */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>2. Variants & Multi-Tier Pricing</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure sizes, colors, retail & wholesale selling prices, and initial stocks.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleAddVariant}
              >
                Add Variant
              </Button>
            </div>

            <div className="space-y-3.5">
              {variants.map((v, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 relative group"
                >
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(idx)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                      title="Remove variant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Top Variant Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Variant / Attribute Name *
                      </label>
                      <input
                        type="text"
                        value={v.attributeName}
                        onChange={(e) => handleVariantChange(idx, 'attributeName', e.target.value)}
                        placeholder="e.g. Standard, 1kg, Red-XL"
                        className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        SKU (Auto/Unique) *
                      </label>
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => handleVariantChange(idx, 'sku', e.target.value.toUpperCase())}
                        className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono uppercase text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Barcode (EAN-13 / Code-128)
                      </label>
                      <input
                        type="text"
                        value={v.barcode || ''}
                        onChange={(e) => handleVariantChange(idx, 'barcode', e.target.value)}
                        placeholder="Scan or leave empty for SKU"
                        className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Pricing & Stock Numbers */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                    {!isCashier && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Cost Price (৳)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.costPrice}
                          onChange={(e) => handleVariantChange(idx, 'costPrice', e.target.value)}
                          className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-emerald-400 mb-1">
                        Retail Price (৳) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.retailSellingPrice}
                        onChange={(e) => handleVariantChange(idx, 'retailSellingPrice', e.target.value)}
                        className="w-full h-8 px-2.5 bg-slate-900 border border-emerald-500/50 rounded-lg text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                        required
                      />
                    </div>

                    {!isCashier && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Wholesale (৳)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.wholesaleSellingPrice}
                          onChange={(e) =>
                            handleVariantChange(idx, 'wholesaleSellingPrice', e.target.value)
                          }
                          className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Current Stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={v.currentStock}
                        onChange={(e) => handleVariantChange(idx, 'currentStock', e.target.value)}
                        className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Alert Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={v.alertQty}
                        onChange={(e) => handleVariantChange(idx, 'alertQty', e.target.value)}
                        className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {productId ? 'Update Product' : 'Save Product'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
