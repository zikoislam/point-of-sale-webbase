'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Pencil, Power, Shield, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';
import { PermissionChecklist } from '../../../components/admin/PermissionChecklist';

interface Plan {
  _id: string;
  name: string;
  code: string;
  durationDays: number;
  price: number;
  description?: string;
  features: string[];
  permissionSet: string[];
  applyPermissions: boolean;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = {
  name: '',
  code: '',
  durationDays: 30,
  price: 0,
  description: '',
  features: '',
  permissionSet: [] as string[],
  applyPermissions: true,
  sortOrder: 0,
};

export default function PlansPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isSuper = !!user?.isPlatformSuperAdmin;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: plans = [], isLoading, refetch, isRefetching } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: async () => {
      const res = await api.get('/platform/plans', { params: { all: 1 } });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: isSuper,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform-plans'] });

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan._id);
    setForm({
      name: plan.name,
      code: plan.code,
      durationDays: plan.durationDays,
      price: plan.price || 0,
      description: plan.description || '',
      features: (plan.features || []).join(', '),
      permissionSet: [...(plan.permissionSet || [])],
      applyPermissions: plan.applyPermissions,
      sortOrder: plan.sortOrder || 0,
    });
    setModalOpen(true);
  };

  const payload = () => ({
    name: form.name.trim(),
    code: form.code.trim(),
    durationDays: Number(form.durationDays) || 30,
    price: Number(form.price) || 0,
    description: form.description.trim() || undefined,
    features: form.features
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean),
    permissionSet: form.permissionSet,
    applyPermissions: form.applyPermissions,
    sortOrder: Number(form.sortOrder) || 0,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) await api.patch(`/platform/plans/${editingId}`, payload());
      else await api.post('/platform/plans', payload());
    },
    onSuccess: () => {
      toast.success(editingId ? 'Plan updated' : 'Plan created');
      setModalOpen(false);
      invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/platform/plans/${id}/toggle`);
    },
    onSuccess: () => {
      toast.success('Plan status updated');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!isSuper) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Only the platform Super Admin can manage plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Subscription Plans</h1>
            <p className="text-sm text-slate-400">
              Plan 1 / Plan 2 / Plan 3 — duration, price, features and the permission set a key grants
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={openNew}>
            New Plan
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-sm">
          No plans yet. Create Plan 1, Plan 2, Plan 3…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{plan.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{plan.code}</p>
                </div>
                <Badge variant={plan.isActive ? 'success' : 'neutral'} size="sm">
                  {plan.isActive ? 'ACTIVE' : 'OFF'}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span>{plan.durationDays} days</span>
                <span>৳{plan.price}</span>
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {plan.permissionSet.length} permissions
                </span>
              </div>

              {plan.features?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {plan.features.map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                      {f}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-1">
                <Button variant="outline" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(plan)}>
                  Edit
                </Button>
                <Button
                  variant={plan.isActive ? 'danger' : 'success'}
                  size="sm"
                  leftIcon={<Power className="w-3.5 h-3.5" />}
                  loading={toggle.isPending}
                  onClick={() => toggle.mutate(plan._id)}
                >
                  {plan.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Plan' : 'New Plan'}
        subtitle="A key issued from this plan gives its duration and (optionally) sets the org's permission set"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Plan name *</label>
              <Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="Plan 1" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Code *</label>
              <Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="PLAN_1" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Duration (days) *</label>
              <Input
                type="number"
                value={String(form.durationDays)}
                onChange={(e: any) => setForm({ ...form, durationDays: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Price (label)</label>
              <Input
                type="number"
                value={String(form.price)}
                onChange={(e: any) => setForm({ ...form, price: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">Description</label>
            <Input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} className="mt-1" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">Features (comma separated, display only)</label>
            <Input
              value={form.features}
              onChange={(e: any) => setForm({ ...form, features: e.target.value })}
              placeholder="POS, Inventory, Reports"
              className="mt-1"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={form.applyPermissions}
              onChange={(e) => setForm({ ...form, applyPermissions: e.target.checked })}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 accent-emerald-500"
            />
            On redemption, set the organization&apos;s permission set to the list below (feature gate)
          </label>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              Permissions this plan grants
            </label>
            <PermissionChecklist
              selected={form.permissionSet}
              onChange={(next) => setForm({ ...form, permissionSet: next })}
              disabled={!form.applyPermissions}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!form.name.trim() || !form.code.trim()}
              onClick={() => save.mutate()}
            >
              {editingId ? 'Save Plan' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
