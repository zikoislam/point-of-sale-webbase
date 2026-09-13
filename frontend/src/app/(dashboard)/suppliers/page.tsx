'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { formatCurrency, cn } from '../../../lib/utils';
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  DollarSign,
  FileText,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { SearchInput } from '../../../components/ui/SearchInput';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SupplierFormModal } from '../../../components/modals/SupplierFormModal';
import { SupplierPaymentModal } from '../../../components/modals/SupplierPaymentModal';
import { useToast } from '../../../components/ui/Toast';

interface Supplier {
  id: string;
  _id?: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  currentPayableBalance: number;
  isActive: boolean;
  createdAt: string;
}

export default function SuppliersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Supplier | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Suppliers List
  const {
    data: suppliers = [],
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery<Supplier[]>({
    queryKey: ['suppliers-list', search],
    queryFn: async () => {
      const params: Record<string, any> = { limit: 100 };
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/suppliers', { params });
      // Backend returns: { success, data: { data: [...], total, page, totalPages } }
      if (Array.isArray(res.data?.data)) return res.data.data;
      if (Array.isArray(res.data)) return res.data;
      return [];
    },
    retry: 1,
  });

  // Invalidate cache and force fresh fetch from server
  const invalidateSuppliers = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
  };

  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setSelectedSupplier(s);
    setFormModalOpen(true);
  };

  const handleOpenPay = (s: Supplier) => {
    setPayTarget(s);
    setPaymentModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.currentPayableBalance > 0) {
      toast.error(
        `Cannot delete supplier with an outstanding payable balance of ${formatCurrency(
          deleteTarget.currentPayableBalance
        )}.`
      );
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/suppliers/${deleteTarget.id || deleteTarget._id}`);
      toast.success(`Supplier "${deleteTarget.companyName}" deleted successfully.`);
      setDeleteTarget(null);
      invalidateSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete supplier.');
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
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Suppliers & Vendors</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage procurement vendors, accounts payable & transaction ledgers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh suppliers"
          >
            <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin text-blue-400')} />
          </button>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md max-w-md">
        <SearchInput
          placeholder="Search company name, contact person or phone..."
          value={search}
          onChange={(val) => setSearch(val)}
        />
      </div>

      {/* Suppliers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3.5 px-4">Company & Representative</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Warehouse Address</th>
                <th className="py-3.5 px-4 text-right">Payable Balance</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-xs">Loading suppliers directory...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-300">Failed to load suppliers</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(error as any)?.message || 'Could not connect to server.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No suppliers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click "Add Supplier" to register your vendor accounts.
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => {
                  const id = s.id || s._id || '';
                  const hasDue = s.currentPayableBalance > 0;
                  return (
                    <tr key={id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white tracking-tight">
                          {s.companyName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Rep: {s.contactPerson}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.phone}</span>
                        </div>
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span className="truncate max-w-[180px]">{s.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300 max-w-xs truncate">
                        {s.address || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={cn(
                            'font-bold text-sm',
                            hasDue ? 'text-amber-400' : 'text-emerald-400'
                          )}
                        >
                          {formatCurrency(s.currentPayableBalance)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={s.isActive !== false ? 'success' : 'neutral'} size="sm">
                          {s.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasDue && (
                            <button
                              type="button"
                              onClick={() => handleOpenPay(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
                              title="Disburse Payment"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pay</span>
                            </button>
                          )}

                          <Link
                            href={`/suppliers/${id}/ledger`}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Ledger"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Supplier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete Supplier"
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

      {/* Supplier Form Modal */}
      <SupplierFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setSelectedSupplier(null);
        }}
        onSuccess={() => {
          invalidateSuppliers();
        }}
        supplier={selectedSupplier}
      />

      {/* Supplier Payment Modal */}
      <SupplierPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setPayTarget(null);
        }}
        onSuccess={() => {
          invalidateSuppliers();
        }}
        supplier={payTarget}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Supplier"
        description={
          <span>
            Are you sure you want to delete supplier{' '}
            <strong className="text-white">{deleteTarget?.companyName}</strong>?
          </span>
        }
        confirmText="Delete Supplier"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
