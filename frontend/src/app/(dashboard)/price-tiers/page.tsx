'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, RefreshCw, Pencil, Trash2, Star, BadgePercent } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';

interface PriceTier {
  id: string;
  name: string;
  discountPercent: number;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

const PriceTierFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tier: PriceTier | null;
}> = ({ isOpen, onClose, onSuccess, tier }) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [priority, setPriority] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const key = tier?.id || 'new';
    if (loadedFor === key) return;
    setLoadedFor(key);
    setName(tier?.name || '');
    setDiscountPercent(tier?.discountPercent ?? 0);
    setPriority(tier?.priority ?? 0);
    setIsDefault(tier?.isDefault ?? false);
    setIsActive(tier?.isActive ?? true);
  }, [isOpen, tier, loadedFor]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Tier name is required');
      return;
    }
    setSaving(true);
    try {
      if (tier) {
        await api.put(`/price-tiers/${tier.id}`, { name, discountPercent, priority, isDefault, isActive });
        toast.success('Price tier updated');
      } else {
        await api.post('/price-tiers', { name, discountPercent, priority, isDefault, isActive });
        toast.success('Price tier created');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tier ? 'Edit Price Tier' : 'New Price Tier'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Tier name *</label>
          <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Dealer, Distributor, SR Price" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Discount %</label>
            <Input type="number" min={0} max={100} value={discountPercent} onChange={(e: any) => setDiscountPercent(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Priority</label>
            <Input type="number" value={priority} onChange={(e: any) => setPriority(Number(e.target.value))} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Price = retail price × (1 − discount%). A product can override this with a fixed tier price in the product form.
        </p>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" className="accent-emerald-500" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Default tier
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" className="accent-emerald-500" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>{tier ? 'Save Changes' : 'Create Tier'}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default function PriceTiersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PriceTier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriceTier | null>(null);

  const canManage = user?.isPlatformSuperAdmin || (user?.permissions || []).includes('pricing:manage');

  const { data: tiers = [], isLoading, refetch, isRefetching } = useQuery<PriceTier[]>({
    queryKey: ['price-tiers'],
    queryFn: async () => {
      const res = await api.get('/price-tiers');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/price-tiers/${deleteTarget.id}`);
      toast.success('Price tier deleted');
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteTarget(null);
      refetch();
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Tags className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Price Tiers</h1>
            <p className="text-sm text-slate-400">
              Wholesale & Retail — and any custom tier. Customers on a tier are priced automatically at POS.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/price-tiers/volume-pricing"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <BadgePercent className="w-3.5 h-3.5" />
            Volume / Trade Pricing
          </Link>
          <Button variant="outline" size="sm" leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => { setSelectedTier(null); setModalOpen(true); }}>
              New Tier
            </Button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-10 text-center text-slate-500 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Tier</th>
                <th className="px-5 py-3 text-left">Discount</th>
                <th className="px-5 py-3 text-left">Priority</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tiers.map((tier) => (
                <tr key={tier.id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3.5 text-white font-medium">
                    <span className="inline-flex items-center gap-2">
                      {tier.name}
                      {tier.isDefault && <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">{tier.discountPercent}%</td>
                  <td className="px-5 py-3.5 text-slate-400">{tier.priority}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={tier.isActive ? 'success' : 'danger'} size="sm">{tier.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {canManage && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"
                          title="Edit"
                          onClick={() => { setSelectedTier(tier); setModalOpen(true); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                          title="Delete"
                          onClick={() => setDeleteTarget(tier)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No tiers yet — create one to start tiered pricing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <PriceTierFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['price-tiers'] })}
        tier={selectedTier}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Price Tier"
        description={<>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Tiers still assigned to customers are deactivated instead.</>}
        confirmText="Delete Tier"
        variant="danger"
      />
    </div>
  );
}
