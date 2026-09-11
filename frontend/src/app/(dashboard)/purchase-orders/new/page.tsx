'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileCheck,
  Send,
  AlertCircle,
  Package,
  Calendar,
  Building2,
  Receipt,
  FileText,
} from 'lucide-react';

interface SupplierOption {
  value: string;
  label: string;
}

interface ProductVariantItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  attributeSummary: string;
  costPrice: number;
}

interface POLineItem {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  unitCost: number;
  lineTotal: number;
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const toast = useToast();

  // Suppliers & Products State
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [availableVariants, setAvailableVariants] = useState<ProductVariantItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form Fields
  const [items, setItems] = useState<POLineItem[]>([]);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Search & Selector State
  const [variantSearch, setVariantSearch] = useState('');
  const [isSearchingVariants, setIsSearchingVariants] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initial data loading
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        // Load suppliers
        const supRes = await api.get('/suppliers?limit=100');
        const supList = Array.isArray(supRes.data)
          ? supRes.data
          : Array.isArray(supRes.data?.data)
          ? supRes.data.data
          : [];
        setSuppliers(
          supList.map((s: any) => ({
            value: s.id || s._id,
            label: `${s.companyName} (${s.contactPerson || s.phone})`,
          }))
        );

        // Load active products to extract variants
        const prodRes = await api.get('/products?limit=100&isActive=true');
        const prodList = Array.isArray(prodRes.data)
          ? prodRes.data
          : Array.isArray(prodRes.data?.products)
          ? prodRes.data.products
          : [];

        const variantsList: ProductVariantItem[] = [];
        prodList.forEach((prod: any) => {
          if (Array.isArray(prod.variants)) {
            prod.variants.forEach((v: any) => {
              const attrStr = Array.isArray(v.attributes)
                ? v.attributes.map((a: any) => `${a.name}: ${a.value}`).join(', ')
                : '';
              variantsList.push({
                variantId: v.id || v._id,
                productId: prod.id || prod._id,
                productName: prod.name,
                sku: v.sku,
                attributeSummary: attrStr,
                costPrice: v.costPrice || 0,
              });
            });
          }
        });
        setAvailableVariants(variantsList);
      } catch (err: any) {
        toast.error('Load Error', 'Failed to load suppliers or products');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Filtered variants for search
  const filteredVariants = variantSearch.trim()
    ? availableVariants.filter(
        (v) =>
          v.productName.toLowerCase().includes(variantSearch.toLowerCase()) ||
          v.sku.toLowerCase().includes(variantSearch.toLowerCase()) ||
          v.attributeSummary.toLowerCase().includes(variantSearch.toLowerCase())
      )
    : [];

  const handleAddVariant = (v: ProductVariantItem) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.variantId === v.variantId);
      if (existing) {
        return prev.map((item) =>
          item.variantId === v.variantId
            ? {
                ...item,
                orderedQty: item.orderedQty + 1,
                lineTotal: (item.orderedQty + 1) * item.unitCost,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          variantId: v.variantId,
          productName: v.attributeSummary
            ? `${v.productName} (${v.attributeSummary})`
            : v.productName,
          sku: v.sku,
          orderedQty: 1,
          unitCost: v.costPrice || 0,
          lineTotal: v.costPrice || 0,
        },
      ];
    });
    setVariantSearch('');
    setIsSearchingVariants(false);
  };

  const handleUpdateItem = (
    index: number,
    field: 'orderedQty' | 'unitCost',
    val: number
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      const numVal = Math.max(0, val || 0);

      if (field === 'orderedQty') target.orderedQty = numVal;
      if (field === 'unitCost') target.unitCost = numVal;

      target.lineTotal = parseFloat((target.orderedQty * target.unitCost).toFixed(2));
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial calculations
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const grandTotal = subtotal + Number(taxAmount || 0) + Number(shippingCost || 0);

  const handleSubmit = async (markAsOrdered: boolean) => {
    setError('');

    if (!selectedSupplierId) {
      setError('Please select a supplier.');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one line item to the purchase order.');
      return;
    }

    for (const item of items) {
      if (item.orderedQty <= 0) {
        setError(`Quantity for "${item.productName}" must be greater than zero.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        supplierId: selectedSupplierId,
        items: items.map((i) => ({
          variantId: i.variantId,
          productName: i.productName,
          sku: i.sku,
          orderedQty: i.orderedQty,
          unitCost: i.unitCost,
        })),
        taxAmount: Number(taxAmount) || 0,
        shippingCost: Number(shippingCost) || 0,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await api.post('/purchase-orders', payload);
      const newPo = res.data;

      // If user chose "Save & Mark as Ordered", update status
      if (markAsOrdered && newPo?._id) {
        await api.patch(`/purchase-orders/${newPo._id}/status`, { status: 'ORDERED' });
      }

      toast.success(
        'PO Created Successfully',
        markAsOrdered
          ? `PO marked as ORDERED with number: ${newPo?.poNumber || ''}`
          : `PO saved as DRAFT with number: ${newPo?.poNumber || ''}`
      );

      router.push(newPo?._id ? `/purchase-orders/${newPo._id}` : '/purchase-orders');
    } catch (err: any) {
      setError(err?.message || 'Failed to create Purchase Order. Please review input.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/purchase-orders')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Create Purchase Order
            </h1>
            <p className="text-sm text-slate-400">
              Procure stock from suppliers with real-time costing and inventory forecasting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            isLoading={submitting}
            leftIcon={<FileCheck className="w-4 h-4" />}
          >
            Save as Draft
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSubmit(true)}
            isLoading={submitting}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Save & Mark as Ordered
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Items & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Selection */}
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2 text-slate-200">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>1. Supplier & Procurement Details</span>
                </div>
              }
            />
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Supplier Company"
                    value={selectedSupplierId}
                    onChange={(val) => setSelectedSupplierId(String(val))}
                    options={suppliers}
                    placeholder="Select Supplier..."
                    required
                  />
                  {suppliers.length === 0 && !loadingInitial && (
                    <p className="text-xs text-amber-400 mt-1">
                      No suppliers found. Please add a supplier first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Expected Delivery Date
                  </label>
                  <Input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Selection */}
          <Card>
            <CardHeader
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>2. Add Line Items</span>
                  </div>
                  <span className="text-xs font-normal text-slate-400">
                    {items.length} {items.length === 1 ? 'item' : 'items'} added
                  </span>
                </div>
              }
            />
            <CardContent className="space-y-4">
              {/* Product Variant Search Autocomplete */}
              <div className="relative">
                <SearchInput
                  placeholder="Search product name, SKU, or variation..."
                  value={variantSearch}
                  onChange={(val) => {
                    setVariantSearch(val);
                    setIsSearchingVariants(true);
                  }}
                  onFocus={() => setIsSearchingVariants(true)}
                />

                {isSearchingVariants && variantSearch.trim() && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800">
                    {filteredVariants.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-400">
                        No product variants matching &quot;{variantSearch}&quot;
                      </div>
                    ) : (
                      filteredVariants.map((v) => (
                        <div
                          key={v.variantId}
                          onClick={() => handleAddVariant(v)}
                          className="p-3 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-100">
                              {v.productName}
                            </p>
                            <p className="text-xs text-slate-400">
                              SKU: <span className="font-mono text-slate-300">{v.sku}</span>
                              {v.attributeSummary && ` • ${v.attributeSummary}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Default Cost</p>
                            <p className="text-sm font-semibold text-emerald-400">
                              {formatCurrency(v.costPrice)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Items Table */}
              {items.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center">
                  <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">No items added yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Use the search bar above to search for products and add them to this purchase order.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-900/30">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Product / SKU</th>
                        <th className="p-3 w-32">Ordered Qty</th>
                        <th className="p-3 w-36">Unit Cost (৳)</th>
                        <th className="p-3 w-32 text-right">Line Total</th>
                        <th className="p-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {items.map((item, idx) => (
                        <tr key={item.variantId || idx} className="hover:bg-slate-850/40">
                          <td className="p-3">
                            <p className="font-medium text-slate-200">{item.productName}</p>
                            <p className="text-xs font-mono text-slate-400">{item.sku}</p>
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min={1}
                              value={item.orderedQty}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'orderedQty', parseFloat(e.target.value) || 0)
                              }
                              className="h-8 text-sm font-semibold"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) =>
                                handleUpdateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)
                              }
                              className="h-8 text-sm font-semibold"
                            />
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-100">
                            {formatCurrency(item.lineTotal)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Order Instructions & Internal Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Deliver to Warehouse #2, package fragile items with bubble wrap..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Financial Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2 text-slate-200">
                  <Receipt className="w-4 h-4 text-blue-400" />
                  <span>3. Cost & Order Summary</span>
                </div>
              }
            />
            <CardContent className="space-y-4">
              <div className="space-y-3 pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Items Subtotal:</span>
                  <span className="font-semibold text-slate-200">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-400">Estimated Tax:</span>
                  <div className="w-32">
                    <Input
                      type="number"
                      min={0}
                      value={taxAmount || ''}
                      placeholder="0.00"
                      onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                      className="h-8 text-right text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-400">Shipping / Freight:</span>
                  <div className="w-32">
                    <Input
                      type="number"
                      min={0}
                      value={shippingCost || ''}
                      placeholder="0.00"
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      className="h-8 text-right text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-base font-bold text-slate-100 block">
                    Grand Total
                  </span>
                  <span className="text-xs text-slate-400">
                    Net amount payable to supplier
                  </span>
                </div>
                <span className="text-2xl font-bold text-blue-400">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => handleSubmit(true)}
                  isLoading={submitting}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Save & Mark as Ordered
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleSubmit(false)}
                  isLoading={submitting}
                  leftIcon={<FileCheck className="w-4 h-4" />}
                >
                  Save as Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
