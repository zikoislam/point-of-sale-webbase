'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderTree,
  CornerDownRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CategoryFormModal } from '../../../components/modals/CategoryFormModal';
import { useToast } from '../../../components/ui/Toast';
import { cn } from '../../../lib/utils';

interface CategoryNode {
  id: string;
  _id?: string;
  name: string;
  code: string;
  description?: string;
  defaultTaxRate: number;
  parentId?: string;
  parentName?: string;
  isActive: boolean;
  children?: CategoryNode[];
  productCount?: number;
}

export default function CategoriesPage() {
  const toast = useToast();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Tree & Flat categories
  const {
    data: categoriesTree = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<CategoryNode[]>({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: flatCategories = [] } = useQuery<CategoryNode[]>({
    queryKey: ['categories-flat'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { flat: true } });
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenCreateRoot = () => {
    setSelectedCategory(null);
    setParentForNew(null);
    setModalOpen(true);
  };

  const handleAddSubcategory = (parentId: string) => {
    setSelectedCategory(null);
    setParentForNew(parentId);
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryNode) => {
    setSelectedCategory(cat);
    setParentForNew(cat.parentId || null);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await api.delete(`/categories/${deleteTarget.id || deleteTarget._id}`);
      toast.success(`Category "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      if (err.statusCode === 409 || err.code === 'CONFLICT') {
        toast.error('Cannot delete category because it contains active products.');
      } else {
        toast.error(err.message || 'Failed to delete category.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Render Category Node in Table
  const renderCategoryRow = (cat: CategoryNode, depth = 0) => {
    const id = cat.id || cat._id || '';
    const hasChildren = Boolean(cat.children && cat.children.length > 0);
    const isExpanded = expandedNodes[id] ?? true; // Default expanded

    return (
      <React.Fragment key={id}>
        <tr className="hover:bg-slate-800/40 transition-colors group border-b border-slate-800/60">
          {/* Name & Hierarchy Chevron */}
          <td className="py-3.5 px-4">
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft: `${depth * 24}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleNode(id)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      !isExpanded && '-rotate-90 text-slate-500'
                    )}
                  />
                </button>
              ) : depth > 0 ? (
                <CornerDownRight className="w-3.5 h-3.5 text-slate-600 shrink-0 ml-1" />
              ) : (
                <span className="w-4" />
              )}

              <span className="font-semibold text-white text-sm tracking-tight">{cat.name}</span>
            </div>
          </td>

          {/* Category Code */}
          <td className="py-3.5 px-4">
            <span className="font-mono text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
              {cat.code}
            </span>
          </td>

          {/* Default VAT */}
          <td className="py-3.5 px-4 text-slate-300 text-xs">
            {cat.defaultTaxRate}%
          </td>

          {/* Status */}
          <td className="py-3.5 px-4 text-center">
            <Badge variant={cat.isActive !== false ? 'success' : 'neutral'} size="sm">
              {cat.isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
          </td>

          {/* Action Buttons */}
          <td className="py-3.5 px-4 text-right">
            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleAddSubcategory(id)}
                className="px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded border border-blue-500/20 font-medium transition"
                title="Add Subcategory"
              >
                + Sub
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(cat)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Edit Category"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(cat)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Delete Category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>

        {/* Recursive Children Rows */}
        {hasChildren &&
          isExpanded &&
          cat.children!.map((child) => renderCategoryRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Product Categories</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Organize catalog with multi-level parent and subcategories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh categories"
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin text-blue-400')} />
          </button>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreateRoot}
          >
            Add Category
          </Button>
        </div>
      </div>

      {/* Tree Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3.5 px-4">Category Name & Hierarchy</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Default VAT</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-xs">Loading categories tree...</p>
                  </td>
                </tr>
              ) : categoriesTree.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <Tags className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No categories found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click "Add Category" to establish your shop's product taxonomy.
                    </p>
                  </td>
                </tr>
              ) : (
                categoriesTree.map((cat) => renderCategoryRow(cat, 0))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCategory(null);
          setParentForNew(null);
        }}
        onSuccess={() => {
          refetch();
        }}
        category={selectedCategory}
        parentCategoryId={parentForNew}
        categoriesList={flatCategories}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        description={
          <span>
            Are you sure you want to delete category{' '}
            <strong className="text-white">{deleteTarget?.name}</strong>? If this category has
            products assigned to it, deletion will be rejected.
          </span>
        }
        confirmText="Delete Category"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
