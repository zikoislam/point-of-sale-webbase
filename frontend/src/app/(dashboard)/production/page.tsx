'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Factory, Plus, RefreshCw, Play, Check, X, Trash2, Package } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';

interface ProductRow { _id?: string; id?: string; name: string; isActive?: boolean; variants?: any[] }
interface BomItem { productId: string; quantity: number; wastagePercent: number }
interface Bom {
  id: string; name: string; version: number; outputQty: number; laborCost: number; overheadCost: number;
  isActive: boolean; productId: any; items: any[];
}
interface Run {
  id: string; runNo: string; status: string; plannedQty: number; producedQty: number;
  materialCost: number; laborCost: number; overheadCost: number; unitCost: number;
  bomId?: any; productId?: any; issues: any[]; notes?: string; createdAt: string;
}

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);

export default function ProductionPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const has = (p: string) => isSuper || perms.includes(p);

  const [activeTab, setActiveTab] = useState('runs');
  const [bomModal, setBomModal] = useState(false);
  const [bomForm, setBomForm] = useState<{ name: string; productId: string; outputQty: number; laborCost: number; overheadCost: number; items: BomItem[] }>({
    name: '', productId: '', outputQty: 1, laborCost: 0, overheadCost: 0, items: [{ productId: '', quantity: 1, wastagePercent: 0 }],
  });
  const [runModal, setRunModal] = useState<Bom | null>(null);
  const [plannedQty, setPlannedQty] = useState(1);
  const [completeModal, setCompleteModal] = useState<Run | null>(null);
  const [producedQty, setProducedQty] = useState(0);

  const canView = has('production:view');
  const canManage = has('production:manage');
  const canExecute = has('production:execute');

  const { data: boms = [], isLoading: bomsLoading } = useQuery<Bom[]>({
    queryKey: ['production-boms'],
    queryFn: async () => (await api.get('/production/boms')).data || [],
    enabled: canView,
  });
  const { data: runs = [], isLoading: runsLoading } = useQuery<Run[]>({
    queryKey: ['production-runs'],
    queryFn: async () => (await api.get('/production/runs')).data || [],
    enabled: canView,
  });
  const { data: products = [] } = useQuery<ProductRow[]>({
    queryKey: ['production-products'],
    queryFn: async () => {
      const res = await api.get('/products?limit=100');
      const rows = Array.isArray(res.data) ? res.data : res.data?.products || [];
      return rows;
    },
    enabled: canManage || canExecute,
  });

  const invalidate = () => ['production-boms', 'production-runs'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const createBom = useMutation({
    mutationFn: async () => {
      await api.post('/production/boms', {
        ...bomForm,
        items: bomForm.items.filter((i) => i.productId && i.quantity > 0),
      });
    },
    onSuccess: () => { toast.success('BOM created'); setBomModal(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const createRun = useMutation({
    mutationFn: async () => { await api.post('/production/runs', { bomId: runModal!.id, plannedQty }); },
    onSuccess: () => { toast.success('Run planned'); setRunModal(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const startRun = useMutation({
    mutationFn: async (id: string) => { await api.post(`/production/runs/${id}/start`); },
    onSuccess: () => { toast.success('Materials issued'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const completeRun = useMutation({
    mutationFn: async () => { await api.post(`/production/runs/${completeModal!.id}/complete`, { producedQty }); },
    onSuccess: () => { toast.success('Finished goods added to stock'); setCompleteModal(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelRun = useMutation({
    mutationFn: async (id: string) => { await api.post(`/production/runs/${id}/cancel`); },
    onSuccess: () => { toast.success('Run cancelled'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const productName = (p: any) => p?.name || '—';

  const tabDefs = [
    { key: 'runs', label: 'Production Runs' },
    { key: 'boms', label: 'BOMs (Recipes)', count: boms.length },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg">
            <Factory className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Production</h1>
            <p className="text-sm text-slate-400">Recipes (BOM), production runs, material issue and finished goods</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw />} onClick={() => invalidate()}>Refresh</Button>
          {canManage && (
            <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => { setBomForm({ name: '', productId: '', outputQty: 1, laborCost: 0, overheadCost: 0, items: [{ productId: '', quantity: 1, wastagePercent: 0 }] }); setBomModal(true); }}>
              New BOM
            </Button>
          )}
        </div>
      </div>

      <Tabs tabs={tabDefs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

      {activeTab === 'runs' && (
        <div className="space-y-3">
          {runsLoading && <div className="flex justify-center py-10"><Spinner /></div>}
          {runs.map((run) => (
            <div key={run.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {run.runNo} — {productName(run.productId)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {run.bomId?.name} v{run.bomId?.version} • planned {run.plannedQty}
                    {run.producedQty ? ` • produced ${run.producedQty}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'IN_PROGRESS' ? 'warning' : run.status === 'CANCELLED' ? 'danger' : 'info'} size="sm">
                    {run.status.replace('_', ' ')}
                  </Badge>
                  {canManage && run.status === 'PLANNED' && (
                    <Button variant="primary" size="sm" leftIcon={<Play className="w-3.5 h-3.5" />} onClick={() => startRun.mutate(run.id)}>Start</Button>
                  )}
                  {canExecute && run.status === 'IN_PROGRESS' && (
                    <Button variant="success" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => { setCompleteModal(run); setProducedQty(run.plannedQty); }}>Complete</Button>
                  )}
                  {canManage && run.status === 'PLANNED' && (
                    <Button variant="ghost" size="sm" leftIcon={<X className="w-3.5 h-3.5" />} onClick={() => cancelRun.mutate(run.id)}>Cancel</Button>
                  )}
                </div>
              </div>
              {run.status !== 'PLANNED' && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-800/60 rounded-xl p-2"><p className="text-[10px] text-slate-500 uppercase">Materials</p><p className="text-sm font-bold text-white">{money(run.materialCost)}</p></div>
                  <div className="bg-slate-800/60 rounded-xl p-2"><p className="text-[10px] text-slate-500 uppercase">Labor</p><p className="text-sm font-bold text-white">{money(run.laborCost)}</p></div>
                  <div className="bg-slate-800/60 rounded-xl p-2"><p className="text-[10px] text-slate-500 uppercase">Overhead</p><p className="text-sm font-bold text-white">{money(run.overheadCost)}</p></div>
                  <div className="bg-slate-800/60 rounded-xl p-2"><p className="text-[10px] text-slate-500 uppercase">Unit cost</p><p className="text-sm font-bold text-white">{run.unitCost ? money(run.unitCost) : '—'}</p></div>
                </div>
              )}
              {run.issues?.length > 0 && (
                <div className="mt-3 text-[11px] text-slate-400 space-y-1">
                  {run.issues.map((iss: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <Package className="w-3 h-3 text-slate-600" />
                      <span>{iss.productName} ({iss.variantSku}) — {iss.quantity} @ {money(iss.unitCost)} = {money(iss.lineCost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!runsLoading && runs.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm">
              No production runs yet — plan one from a BOM.
            </div>
          )}
        </div>
      )}

      {activeTab === 'boms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bomsLoading && <div className="col-span-full flex justify-center py-10"><Spinner /></div>}
          {boms.map((bom) => (
            <div key={bom.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{bom.name}</p>
                  <p className="text-[11px] text-slate-500">{productName(bom.productId)} • v{bom.version} • output {bom.outputQty}</p>
                </div>
                <Badge variant={bom.isActive ? 'success' : 'neutral'} size="sm">{bom.isActive ? 'Active' : 'Archived'}</Badge>
              </div>
              <div className="space-y-1">
                {bom.items?.map((item: any, i: number) => {
                  const comp = item.componentProductId || item.productId;
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                      <span>{comp?.name || '—'}</span>
                      <span>{item.quantity}{item.wastagePercent ? ` (+${item.wastagePercent}%)` : ''}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Labor {money(bom.laborCost)} • Overhead {money(bom.overheadCost)}</span>
                {canManage && bom.isActive && (
                  <Button variant="outline" size="sm" leftIcon={<Play className="w-3 h-3" />} onClick={() => { setRunModal(bom); setPlannedQty(bom.outputQty); }}>
                    Plan Run
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!bomsLoading && boms.length === 0 && (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm">
              No BOMs yet — create a recipe to start producing.
            </div>
          )}
        </div>
      )}

      {/* BOM modal */}
      <Modal isOpen={bomModal} onClose={() => setBomModal(false)} title="New BOM (Recipe)" size="lg">
        <div className="space-y-3">
          <Input placeholder="Recipe name (e.g. 1L Bottled Drink)" value={bomForm.name} onChange={(e: any) => setBomForm({ ...bomForm, name: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={bomForm.productId} onChange={(e: any) => setBomForm({ ...bomForm, productId: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
              <option value="">Finished good</option>
              {products.map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
            </select>
            <Input type="number" placeholder="Output qty" value={bomForm.outputQty} onChange={(e: any) => setBomForm({ ...bomForm, outputQty: Number(e.target.value) })} />
            <Input type="number" placeholder="Labor cost / run" value={bomForm.laborCost} onChange={(e: any) => setBomForm({ ...bomForm, laborCost: Number(e.target.value) })} />
          </div>
          <Input type="number" placeholder="Overhead cost / run" value={bomForm.overheadCost} onChange={(e: any) => setBomForm({ ...bomForm, overheadCost: Number(e.target.value) })} />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Components</p>
            {bomForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={item.productId}
                  onChange={(e) => {
                    const items = [...bomForm.items];
                    items[idx] = { ...item, productId: e.target.value };
                    setBomForm({ ...bomForm, items });
                  }}
                  className="col-span-6 h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                >
                  <option value="">Component</option>
                  {products.map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                </select>
                <Input type="number" step="0.001" placeholder="Qty" value={item.quantity} onChange={(e) => { const items = [...bomForm.items]; items[idx] = { ...item, quantity: Number(e.target.value) }; setBomForm({ ...bomForm, items }); }} />
                <Input type="number" placeholder="W %" value={item.wastagePercent} onChange={(e) => { const items = [...bomForm.items]; items[idx] = { ...item, wastagePercent: Number(e.target.value) }; setBomForm({ ...bomForm, items }); }} />
                <button type="button" className="col-span-1 p-2 text-rose-400 hover:bg-slate-800 rounded-lg" onClick={() => setBomForm({ ...bomForm, items: bomForm.items.filter((_, i) => i !== idx) })}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" leftIcon={<Plus />} onClick={() => setBomForm({ ...bomForm, items: [...bomForm.items, { productId: '', quantity: 1, wastagePercent: 0 }] })}>
              Add component
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setBomModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createBom.isPending}
              disabled={!bomForm.name || !bomForm.productId || bomForm.items.every((i) => !i.productId)}
              onClick={() => createBom.mutate()}
            >
              Create BOM
            </Button>
          </div>
        </div>
      </Modal>

      {/* Plan run modal */}
      <Modal isOpen={!!runModal} onClose={() => setRunModal(null)} title="Plan Production Run" subtitle={runModal?.name} size="sm">
        <div className="space-y-3">
          <Input type="number" placeholder="Planned quantity" value={plannedQty} onChange={(e: any) => setPlannedQty(Number(e.target.value))} />
          <p className="text-[11px] text-slate-500">Stock availability is checked now; materials are consumed when the run starts.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRunModal(null)}>Cancel</Button>
            <Button variant="primary" loading={createRun.isPending} disabled={plannedQty <= 0} onClick={() => createRun.mutate()}>Plan Run</Button>
          </div>
        </div>
      </Modal>

      {/* Complete modal */}
      <Modal isOpen={!!completeModal} onClose={() => setCompleteModal(null)} title="Complete Run" subtitle={completeModal?.runNo} size="sm">
        <div className="space-y-3">
          <Input type="number" placeholder="Produced quantity" value={producedQty} onChange={(e: any) => setProducedQty(Number(e.target.value))} />
          <p className="text-[11px] text-slate-500">Finished goods are added to stock and the unit cost (materials + labor + overhead) is applied.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCompleteModal(null)}>Cancel</Button>
            <Button variant="success" loading={completeRun.isPending} disabled={producedQty <= 0} onClick={() => completeRun.mutate()}>Complete Run</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
