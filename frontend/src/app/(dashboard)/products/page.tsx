'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { api } from '../../../lib/api-client';
import { formatCurrency, cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Barcode,
  Layers,
  AlertTriangle,
  RefreshCw,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Pagination } from '../../../components/ui/Pagination';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ProductFormModal } from '../../../components/modals/ProductFormModal';
import { useToast } from '../../../components/ui/Toast';

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
  lowestWholesalePrice?: number;
  variants?: any[];
  firstSku?: string;
  createdAt: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const isCashier = user?.role === 'CASHIER';

  // Filters State
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLowStock, setIsLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Categories & Brands for filters
  const { data: categories = [] } = useQuery({
    queryKey: ['filter-categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['filter-brands'],
    queryFn: async () => {
      const res = await api.get('/brands');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Query Products List
  const {
    data: productsResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['products-list', page, pageSize, search, categoryId, brandId, isLowStock, statusFilter],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.categoryId = categoryId;
      if (brandId) params.brandId = brandId;
      if (isLowStock) params.isLowStock = true;
      if (statusFilter === 'active') params.isActive = true;
      if (statusFilter === 'inactive') params.isActive = false;

      const res = await api.get('/products', { params });
      return {
        products: (res.data?.products || res.data || []) as ProductItem[],
        totalItems: res.meta?.totalItems ?? res.data?.total ?? 0,
        totalPages: res.meta?.totalPages ?? res.data?.totalPages ?? 1,
      };
    },
  });

  const products = productsResponse?.products || [];
  const totalItems = productsResponse?.totalItems || 0;
  const totalPages = productsResponse?.totalPages || 1;

  const handleOpenCreate = () => {
    setSelectedProductId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ProductItem) => {
    setSelectedProductId(p.id);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      toast.success(`Product "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStockBadge = (stock: number, unit: string) => {
    if (stock <= 5) {
      return (
        <Badge variant="danger" size="sm" dot>
          {stock} {unit}
        </Badge>
      );
    }
    if (stock <= 15) {
      return (
        <Badge variant="warning" size="sm" dot>
          {stock} {unit}
        </Badge>
      );
    }
    return (
      <Badge variant="success" size="sm">
        {stock} {unit}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Product Catalog</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage inventory items, barcodes, multi-attribute variants, and pricing tiers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh products"
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin text-blue-400')} />
          </button>

          <Link href="/barcode-labels">
            <Button variant="outline" size="md" leftIcon={<Barcode className="w-4 h-4" />}>
              Barcode Labels
            </Button>
          </Link>

          {!isCashier && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreate}
            >
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Search */}
        <div className="lg:col-span-2">
          <SearchInput
            placeholder="Search by name, SKU or barcode..."
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            hotkeyHint="F2"
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((c: any) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Brand Filter */}
        <div>
          <select
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Brands</option>
            {brands.map((b: any) => (
              <option key={b.id || b._id} value={b.id || b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* Low Stock Toggle Switch */}
        <div>
          <button
            type="button"
            onClick={() => {
              setIsLowStock(!isLowStock);
              setPage(1);
            }}
            className={cn(
              'w-full h-10 flex items-center justify-center gap-2 px-3 rounded-lg text-xs font-semibold border transition-all',
              isLowStock
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock Alert</span>
          </button>
        </div>
      </div>

      {/* Products Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Category & Brand</th>
                <th className="py-3.5 px-4 text-center">Variants</th>
                <th className="py-3.5 px-4 text-center">Current Stock</th>
                <th className="py-3.5 px-4 text-right">Retail Price</th>
                {!isCashier && (
                  <>
                    <th className="py-3.5 px-4 text-right">Wholesale</th>
                    <th className="py-3.5 px-4 text-right">Cost Price</th>
                  </>
                )}
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 9} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-xs">Loading product catalog...</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 9} className="py-16 text-center text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No products found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {search ? 'Try clearing your search query or filters' : 'Get started by adding your first product'}
                    </p>
                    {!search && !isCashier && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-4"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={handleOpenCreate}
                      >
                        Add New Product
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors group">
                    {/* Product Name & SKU */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-[200px]">{p.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            VAT: {p.taxType} ({p.taxRate}%)
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category & Brand */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300">
                          {p.categoryName || 'General'}
                        </span>
                        {p.brandName && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/60 border border-blue-800/50 text-blue-300">
                            {p.brandName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Variant Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        <Layers className="w-3 h-3 text-blue-400" />
                        <span>{p.variantCount} {p.variantCount === 1 ? 'variant' : 'variants'}</span>
                      </span>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3.5 px-4 text-center">
                      {getStockBadge(p.totalStock, p.unit)}
                    </td>

                    {/* Retail Selling Price */}
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                      {formatCurrency(p.lowestRetailPrice)}
                    </td>

                    {/* Wholesale Selling Price (Manager/Admin only) */}
                    {!isCashier && (
                      <td className="py-3.5 px-4 text-right text-slate-300">
                        {p.lowestWholesalePrice !== undefined
                          ? formatCurrency(p.lowestWholesalePrice)
                          : '—'}
                      </td>
                    )}

                    {/* Cost Price (Manager/Admin only) */}
                    {!isCashier && (
                      <td className="py-3.5 px-4 text-right text-slate-400">
                        {p.lowestCostPrice !== undefined ? formatCurrency(p.lowestCostPrice) : '—'}
                      </td>
                    )}

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm">
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/barcode-labels?productId=${p.id}`}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Print Barcode"
                        >
                          <Barcode className="w-4 h-4" />
                        </Link>

                        {!isCashier && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Product"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination at bottom */}
        <div className="border-t border-slate-800 px-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Product Create/Edit Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        productId={selectedProductId}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProductId(null);
        }}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        description={
          <span>
            Are you sure you want to delete <strong className="text-white">{deleteTarget?.name}</strong>?
            This will deactivate the product and its associated variants from catalog.
          </span>
        }
        confirmText="Delete Product"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
