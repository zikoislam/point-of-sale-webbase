'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPinned,
  RefreshCw,
  Plus,
  Users,
  ClipboardList,
  Store,
  Check,
  X,
  ArrowRightLeft,
  TrendingUp,
  Save,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { useToast } from '../../../components/ui/Toast';
import { Tabs } from '../../../components/ui/Tabs';
import { useAuth } from '../../../hooks/useAuth';

interface Zone { id: string; name: string; code: string; description?: string; isActive: boolean; }
interface RouteRow { id: string; name: string; code: string; areas?: string; zoneId?: any; assignedSRId?: any; isActive: boolean; }
interface SalesRep {
  id: string; code: string; name: string; phone: string; commissionPercent: number;
  monthlyTargetAmount: number; isActive: boolean; zoneId?: any; monthSalesTotal?: number;
}
interface SrOrder {
  id: string; orderNo: string; status: string; totalAmount: number; notes?: string; createdAt: string;
  repId?: any; customerId?: any; saleId?: any; items: any[];
}
interface Dealer { _id: string; name: string; phone: string; currentDueBalance: number; creditDays?: number; priceTierId?: any; routeId?: any; assignedSRId?: any; isActive: boolean; }
interface ReportRow {
  rep: { id: string; code: string; name: string; commissionPercent: number; monthlyTargetAmount: number };
  months: Array<{ month: string; total: number; count: number; commission: number; targetAchievedPercent: number | null }>;
}

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);
/** The API returns lean documents — `_id` only, no `id` virtual. */
const idOf = (row: any): string => String(row?._id || row?.id || '');

export default function DistributionPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const has = (p: string) => isSuper || perms.includes(p);

  const [zoneModal, setZoneModal] = useState(false);
  const [routeModal, setRouteModal] = useState(false);
  const [repModal, setRepModal] = useState(false);

  const [zoneForm, setZoneForm] = useState({ name: '', code: '', description: '' });
  const [routeForm, setRouteForm] = useState({ zoneId: '', name: '', code: '', areas: '', assignedSRId: '' });
  const [repForm, setRepForm] = useState({ code: '', name: '', phone: '', zoneId: '', commissionPercent: 0, monthlyTargetAmount: 0 });

  const invalidateAll = () => {
    ['dist-zones', 'dist-routes', 'dist-reps', 'dist-orders', 'dist-dealers', 'dist-report'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const { data: zones = [], isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey: ['dist-zones'],
    queryFn: async () => (await api.get('/distribution/zones')).data || [],
    enabled: has('distribution:manage'),
  });
  const { data: routes = [], isLoading: routesLoading } = useQuery<RouteRow[]>({
    queryKey: ['dist-routes'],
    queryFn: async () => (await api.get('/distribution/routes')).data || [],
    enabled: has('distribution:manage'),
  });
  const { data: reps = [], isLoading: repsLoading } = useQuery<SalesRep[]>({
    queryKey: ['dist-reps'],
    queryFn: async () => (await api.get('/distribution/reps')).data || [],
    enabled: has('sr:view'),
  });
  const { data: orders = [], isLoading: ordersLoading } = useQuery<SrOrder[]>({
    queryKey: ['dist-orders'],
    queryFn: async () => (await api.get('/distribution/orders')).data || [],
    enabled: has('sr:view'),
  });
  const { data: dealers = [], isLoading: dealersLoading } = useQuery<Dealer[]>({
    queryKey: ['dist-dealers'],
    queryFn: async () => (await api.get('/distribution/dealers')).data || [],
    enabled: has('dealer:manage'),
  });
  const { data: report = [] } = useQuery<ReportRow[]>({
    queryKey: ['dist-report'],
    queryFn: async () => (await api.get('/distribution/report')).data || [],
    enabled: has('sr:view'),
  });

  const createZone = useMutation({
    mutationFn: async () => { await api.post('/distribution/zones', zoneForm); },
    onSuccess: () => { toast.success('Zone created'); setZoneModal(false); setZoneForm({ name: '', code: '', description: '' }); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const createRoute = useMutation({
    mutationFn: async () => { await api.post('/distribution/routes', routeForm); },
    onSuccess: () => { toast.success('Route created'); setRouteModal(false); setRouteForm({ zoneId: '', name: '', code: '', areas: '', assignedSRId: '' }); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const createRep = useMutation({
    mutationFn: async () => { await api.post('/distribution/reps', repForm); },
    onSuccess: () => { toast.success('Sales rep created'); setRepModal(false); setRepForm({ code: '', name: '', phone: '', zoneId: '', commissionPercent: 0, monthlyTargetAmount: 0 }); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const orderAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'CONFIRM' | 'CANCEL' }) => {
      await api.patch(`/distribution/orders/${id}/action`, { action });
    },
    onSuccess: (_d, vars) => { toast.success(vars.action === 'CONFIRM' ? 'Order confirmed' : 'Order cancelled'); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });
  const convertOrder = useMutation({
    mutationFn: async (id: string) => { await api.post(`/distribution/orders/${id}/convert`); },
    onSuccess: () => { toast.success('Converted to sale — check Sales History'); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const canManageDist = has('distribution:manage');
  const canManageSr = has('sr:manage');

  const tabDefs = [
    ...(has('sr:view') ? [{ key: 'reps', label: 'Sales Reps' }] : []),
    ...(has('sr:view') ? [{ key: 'orders', label: 'SR Orders', count: orders.length }] : []),
    ...(canManageDist ? [{ key: 'coverage', label: 'Zones & Routes' }] : []),
    ...(has('dealer:manage') ? [{ key: 'dealers', label: 'Dealers' }] : []),
  ];
  const [activeTab, setActiveTab] = useState('reps');
  const effectiveTab = tabDefs.some((t) => t.key === activeTab) ? activeTab : tabDefs[0]?.key || 'reps';

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg">
            <MapPinned className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Distribution & SR</h1>
            <p className="text-sm text-slate-400">Zones, routes, sales representatives, dealer coverage and field orders</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabDefs} activeTab={effectiveTab} onChange={setActiveTab} variant="pills" />

        {/* ── Sales Reps ── */}
        {has('sr:view') && effectiveTab === 'reps' && (
          <>
            <div className="flex justify-end gap-2 mb-3">
              <Button variant="outline" size="sm" leftIcon={<TrendingUp className="w-3.5 h-3.5" />} onClick={() => queryClient.invalidateQueries({ queryKey: ['dist-report'] })}>
                Refresh Report
              </Button>
              {canManageSr && (
                <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => setRepModal(true)}>New SR</Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {repsLoading && <div className="col-span-full flex justify-center py-10"><Spinner /></div>}
              {reps.map((rep) => {
                const thisMonth = new Date().toISOString().slice(0, 7);
                const monthRow = report.find((row) => row.rep.id === idOf(rep))?.months.find((m) => m.month === thisMonth);
                const achieved = monthRow?.total || rep.monthSalesTotal || 0;
                const targetPct = rep.monthlyTargetAmount > 0 ? Math.min(100, Math.round((achieved / rep.monthlyTargetAmount) * 100)) : null;
                return (
                  <div key={idOf(rep)} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{rep.name}</p>
                        <p className="text-[11px] text-slate-500">{rep.code} • {rep.phone}</p>
                      </div>
                      <Badge variant={rep.isActive ? 'success' : 'danger'} size="sm">{rep.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-800/60 rounded-xl p-2">
                        <p className="text-[10px] text-slate-500 uppercase">This month</p>
                        <p className="text-sm font-bold text-white">{money(achieved)}</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-xl p-2">
                        <p className="text-[10px] text-slate-500 uppercase">Target</p>
                        <p className="text-sm font-bold text-white">{rep.monthlyTargetAmount ? money(rep.monthlyTargetAmount) : '—'}</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-xl p-2">
                        <p className="text-[10px] text-slate-500 uppercase">Commission</p>
                        <p className="text-sm font-bold text-white">{rep.commissionPercent}%</p>
                      </div>
                    </div>
                    {targetPct !== null && (
                      <div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${targetPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${targetPct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{targetPct}% of monthly target</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {!repsLoading && reps.length === 0 && (
                <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm">
                  No sales reps yet.
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SR Orders ── */}
        {has('sr:view') && effectiveTab === 'orders' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              {ordersLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-5 py-3 text-left">Order</th>
                      <th className="px-5 py-3 text-left">SR</th>
                      <th className="px-5 py-3 text-left">Customer</th>
                      <th className="px-5 py-3 text-left">Items</th>
                      <th className="px-5 py-3 text-left">Total</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orders.map((o) => (
                      <tr key={idOf(o)} className="hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 text-white font-medium">{o.orderNo}</td>
                        <td className="px-5 py-3.5 text-slate-300">{o.repId?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-300">{o.customerId?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-400">{o.items?.length}</td>
                        <td className="px-5 py-3.5 text-white">{money(o.totalAmount)}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={o.status === 'PENDING' ? 'warning' : o.status === 'CONVERTED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'info'} size="sm">
                            {o.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {o.status === 'PENDING' && canManageSr && (
                            <div className="inline-flex gap-1.5">
                              <button className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg" title="Confirm" onClick={() => orderAction.mutate({ id: idOf(o), action: 'CONFIRM' })}>
                                <Check className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-rose-400 hover:bg-slate-800 rounded-lg" title="Cancel" onClick={() => orderAction.mutate({ id: idOf(o), action: 'CANCEL' })}>
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {o.status === 'CONFIRMED' && canManageSr && (
                            <Button variant="primary" size="sm" leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />} loading={convertOrder.isPending} onClick={() => convertOrder.mutate(idOf(o))}>
                              Convert to Sale
                            </Button>
                          )}
                          {o.status === 'CONVERTED' && o.saleId?.invoiceNo && (
                            <span className="text-[11px] text-slate-500">{o.saleId.invoiceNo}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">No SR orders yet.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

        )}

        {/* ── Zones & Routes ── */}
        {canManageDist && effectiveTab === 'coverage' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2"><MapPinned className="w-4 h-4 text-violet-400" /> Zones</h3>
                  <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => setZoneModal(true)}>Zone</Button>
                </div>
                {zonesLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
                  <div className="divide-y divide-slate-800">
                    {zones.map((z) => (
                      <div key={idOf(z)} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">{z.name} <span className="text-[11px] text-slate-500">({z.code})</span></p>
                          {z.description && <p className="text-[11px] text-slate-500">{z.description}</p>}
                        </div>
                        <Badge variant={z.isActive ? 'success' : 'danger'} size="sm">{z.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    ))}
                    {zones.length === 0 && <div className="px-5 py-8 text-center text-slate-500 text-sm">No zones yet.</div>}
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-400" /> Routes</h3>
                  <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => setRouteModal(true)}>Route</Button>
                </div>
                {routesLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
                  <div className="divide-y divide-slate-800">
                    {routes.map((r: any) => (
                      <div key={idOf(r)} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">{r.name} <span className="text-[11px] text-slate-500">({r.code})</span></p>
                          <p className="text-[11px] text-slate-500">
                            Zone: {r.zoneId?.name || '—'} • SR: {r.assignedSRId?.name || 'unassigned'}
                            {r.areas ? ` • ${r.areas}` : ''}
                          </p>
                        </div>
                        <Badge variant={r.isActive ? 'success' : 'danger'} size="sm">{r.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    ))}
                    {routes.length === 0 && <div className="px-5 py-8 text-center text-slate-500 text-sm">No routes yet.</div>}
                  </div>
                )}
              </div>
            </div>

        )}

        {/* ── Dealers ── */}
        {has('dealer:manage') && effectiveTab === 'dealers' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              {dealersLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-5 py-3 text-left">Dealer</th>
                      <th className="px-5 py-3 text-left">Phone</th>
                      <th className="px-5 py-3 text-left">Route</th>
                      <th className="px-5 py-3 text-left">SR</th>
                      <th className="px-5 py-3 text-left">Tier</th>
                      <th className="px-5 py-3 text-left">Credit Days</th>
                      <th className="px-5 py-3 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dealers.map((d) => (
                      <tr key={d._id} className="hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 text-white font-medium">{d.name}</td>
                        <td className="px-5 py-3.5 text-slate-300">{d.phone}</td>
                        <td className="px-5 py-3.5 text-slate-400">{(d.routeId as any)?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-400">{(d.assignedSRId as any)?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-400">{(d.priceTierId as any)?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-400">{d.creditDays ?? 0}</td>
                        <td className={`px-5 py-3.5 text-right font-medium ${d.currentDueBalance > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {money(d.currentDueBalance)}
                        </td>
                      </tr>
                    ))}
                    {dealers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                          No dealers yet — set a customer&apos;s type to DEALER on the customers page.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

        )}
      {/* Zone modal */}
      <Modal isOpen={zoneModal} onClose={() => setZoneModal(false)} title="New Zone" size="sm">
        <div className="space-y-3">
          <Input placeholder="Zone name (e.g. Dhaka North)" value={zoneForm.name} onChange={(e: any) => setZoneForm({ ...zoneForm, name: e.target.value })} />
          <Input placeholder="Code (e.g. DHK-N)" value={zoneForm.code} onChange={(e: any) => setZoneForm({ ...zoneForm, code: e.target.value })} />
          <Input placeholder="Description (optional)" value={zoneForm.description} onChange={(e: any) => setZoneForm({ ...zoneForm, description: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setZoneModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createZone.isPending} disabled={!zoneForm.name || !zoneForm.code} onClick={() => createZone.mutate()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Route modal */}
      <Modal isOpen={routeModal} onClose={() => setRouteModal(false)} title="New Route" size="sm">
        <div className="space-y-3">
          <select value={routeForm.zoneId} onChange={(e: any) => setRouteForm({ ...routeForm, zoneId: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">Select zone</option>
            {zones.map((z) => <option key={idOf(z)} value={idOf(z)}>{z.name}</option>)}
          </select>
          <Input placeholder="Route name (e.g. Mirpur Beat 1)" value={routeForm.name} onChange={(e: any) => setRouteForm({ ...routeForm, name: e.target.value })} />
          <Input placeholder="Code (e.g. MRP-1)" value={routeForm.code} onChange={(e: any) => setRouteForm({ ...routeForm, code: e.target.value })} />
          <Input placeholder="Areas (comma separated)" value={routeForm.areas} onChange={(e: any) => setRouteForm({ ...routeForm, areas: e.target.value })} />
          <select value={routeForm.assignedSRId} onChange={(e: any) => setRouteForm({ ...routeForm, assignedSRId: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">Assign SR (optional)</option>
            {reps.map((r) => <option key={idOf(r)} value={idOf(r)}>{r.name} ({r.code})</option>)}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRouteModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createRoute.isPending} disabled={!routeForm.zoneId || !routeForm.name || !routeForm.code} onClick={() => createRoute.mutate()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* SR modal */}
      <Modal isOpen={repModal} onClose={() => setRepModal(false)} title="New Sales Representative" size="sm">
        <div className="space-y-3">
          <Input placeholder="SR code (e.g. SR-001)" value={repForm.code} onChange={(e: any) => setRepForm({ ...repForm, code: e.target.value })} />
          <Input placeholder="Full name" value={repForm.name} onChange={(e: any) => setRepForm({ ...repForm, name: e.target.value })} />
          <Input placeholder="Phone" value={repForm.phone} onChange={(e: any) => setRepForm({ ...repForm, phone: e.target.value })} />
          <select value={repForm.zoneId} onChange={(e: any) => setRepForm({ ...repForm, zoneId: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">Select zone (optional)</option>
            {zones.map((z) => <option key={idOf(z)} value={idOf(z)}>{z.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Commission %" value={repForm.commissionPercent} onChange={(e: any) => setRepForm({ ...repForm, commissionPercent: Number(e.target.value) })} />
            <Input type="number" placeholder="Monthly target" value={repForm.monthlyTargetAmount} onChange={(e: any) => setRepForm({ ...repForm, monthlyTargetAmount: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRepModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createRep.isPending} disabled={!repForm.code || !repForm.name || !repForm.phone} onClick={() => createRep.mutate()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
