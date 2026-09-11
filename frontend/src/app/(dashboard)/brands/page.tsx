'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { BrandFormModal } from '../../../components/modals/BrandFormModal';
import { useToast } from '../../../components/ui/Toast';
import { cn } from '../../../lib/utils';

interface Brand {
  id: string;
  _id?: string;
  name: string;
  originCountry?: string;
  logoUrl?: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
}

export default function BrandsPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Brands List
  const {
    data: brands = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<Brand[]>({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const res = await api.get('/brands');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const handleOpenCreate = () => {
    setSelectedBrand(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (brand: Brand) => {
    setSelectedBrand(brand);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await api.delete(`/brands/${deleteTarget.id || deleteTarget._id}`);
      toast.success(`Brand "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete brand.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Brands & Manufacturers</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage manufacturers, origin countries, and product brand labels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh brands"
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin text-blue-400')} />
          </button>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Add Brand
          </Button>
        </div>
      </div>

      {/* Brands Grid / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Origin Country</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-xs">Loading brands...</p>
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-500">
                    <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No brands found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click "Add Brand" to register your first brand or vendor label.
                    </p>
                  </td>
                </tr>
              ) : (
                brands.map((brand) => {
                  const id = brand.id || brand._id || '';
                  return (
                    <tr key={id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                            {brand.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white tracking-tight">{brand.name}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {brand.originCountry ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-300">
                            <Globe className="w-3.5 h-3.5 text-blue-400" />
                            <span>{brand.originCountry}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={brand.isActive !== false ? 'success' : 'neutral'} size="sm">
                          {brand.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(brand)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Brand"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(brand)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete Brand"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Brand Form Modal */}
      <BrandFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedBrand(null);
        }}
        onSuccess={() => {
          refetch();
        }}
        brand={selectedBrand}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Brand"
        description={
          <span>
            Are you sure you want to delete brand{' '}
            <strong className="text-white">{deleteTarget?.name}</strong>?
          </span>
        }
        confirmText="Delete Brand"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
