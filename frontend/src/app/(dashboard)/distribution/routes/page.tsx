'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPinned,
  Plus,
  Pencil,
  Archive,
  Store,
  Route as RouteIcon,
  CalendarDays,
  Users,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { Spinner } from '../../../../components/ui/Spinner';
import { Tabs } from '../../../../components/ui/Tabs';
import { useToast } from '../../../../components/ui/Toast';
import { useAuth } from '../../../../hooks/useAuth';

/**
 * Territories & Routes — the coverage backbone of field sales.
 *
 * A territory (zone) groups routes; a route is the beat an SR serves on given
 * days. Shops (customers) hang off a route, so this page doubles as the SR's
 * call list: open a route and you see the shops to visit.
 */
const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const idOf = (row: any): string => String(row?._id || row?.id || '');
const money = (v: number) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);

interface Territory {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  routeCount?: number;
  customerCount?: number;
}
interface RouteRow {
  _id: string;
  name: string;
  code: string;
  areas?: string;
  daysOfWeek?: string[];
  isActive: boolean;
  customerCount?: number;
  dueTotal?: number;
  zoneId?: any;
  assignedSRId?: any;
}
interface SalesRepRow {
  _id: string;
  name: string;
  code: string;
}

export default function TerritoriesRoutesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const has = (p: string) => isSuper || perms.includes(p);

  const canManage = has('distribution:manage');

  const [activeTab, setActiveTab] = useState('territories');
  const [territoryModal, setTerritoryModal] = useState(false);
  const [routeModal, setRouteModal] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteRow | null>(null);
  const [customersFor, setCustomersFor] = useState<RouteRow | null>(null);

  const [territoryForm, setTerritoryForm] = useState({ name: '', code: '', description: '', isActive: true });
  const [routeForm, setRouteForm] = useState({
    zoneId: '',
    name: '',
    code: '',
    areas: '',
    daysOfWeek: [] as string[],
    assignedSRId: '',
    isActive: true,
  });

  const invalidate = () => {
    ['dist-zones', 'dist-routes'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const { data: territories = [], isLoading: territoriesLoading } = useQuery<Territory[]>({
    queryKey: ['dist-zones'],
    queryFn: async () => (await api.get('/distribution/zones')).data || [],
    enabled: canManage || has('sr:view'),
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery<RouteRow[]>({
    queryKey: ['dist-routes'],
    queryFn: async () => (await api.get('/distribution/routes')).data || [],
    enabled: canManage || has('sr:view'),
  });

  const { data: reps = [] } = useQuery<SalesRepRow[]>({
    queryKey: ['dist-reps'],
    queryFn: async () => (await api.get('/distribution/reps')).data || [],
    enabled: has('sr:view'),
  });

  const { data: routeCustomers = [], isLoading: customersLoading } = useQuery<any[]>({
    queryKey: ['dist-route-customers', customersFor ? idOf(customersFor) : null],
    queryFn: async () => (await api.get(`/distribution/routes/${idOf(customersFor)}/customers`)).data || [],
    enabled: !!customersFor,
  });

  const saveTerritory = useMutation({
    mutationFn: async () => {
      if (editingTerritory) await api.put(`/distribution/zones/${idOf(editingTerritory)}`, territoryForm);
      else await api.post('/distribution/zones', territoryForm);
    },
    onSuccess: () => {
      toast.success(editingTerritory ? 'Territory updated' : 'Territory created');
      setTerritoryModal(false);
      setEditingTerritory(null);
      setTerritoryForm({ name: '', code: '', description: '', isActive: true });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveRoute = useMutation({
    mutationFn: async () => {
      const payload = {
        ...routeForm,
        assignedSRId: routeForm.assignedSRId || null,
      };
      if (editingRoute) await api.put(`/distribution/routes/${idOf(editingRoute)}`, payload);
      else await api.post('/distribution/routes', payload);
    },
    onSuccess: () => {
      toast.success(editingRoute ? 'Route updated' : 'Route created');
      setRouteModal(false);
      setEditingRoute(null);
      setRouteForm({ zoneId: '', name: '', code: '', areas: '', daysOfWeek: [], assignedSRId: '', isActive: true });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ kind, id }: { kind: 'zones' | 'routes'; id: string }) => {
      await api.delete(`/distribution/${kind}/${id}`);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.kind === 'zones' ? 'Territory archived' : 'Route archived');
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditTerritory = (t: Territory) => {
    setEditingTerritory(t);
    setTerritoryForm({
      name: t.name,
      code: t.code,
      description: t.description || '',
      isActive: t.isActive,
    });
    setTerritoryModal(true);
  };

  const openEditRoute = (r: RouteRow) => {
    setEditingRoute(r);
    setRouteForm({
      zoneId: idOf(r.zoneId),
      name: r.name,
      code: r.code,
      areas: r.areas || '',
      daysOfWeek: r.daysOfWeek || [],
      assignedSRId: idOf(r.assignedSRId),
      isActive: r.isActive,
    });
    setRouteModal(true);
  };

  const toggleDay = (day: string) =>
    setRouteForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day],
    }));

  const tabDefs = [
    { key: 'territories', label: `Territories (${territories.length})` },
    { key: 'routes', label: `Routes (${routes.length})` },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 flex items-center justify-center shadow-lg">
            <MapPinned className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Territories &amp; Routes</h1>
            <p className="text-sm text-slate-400">
              Coverage map — territories group routes, routes are the SR beats, shops hang off a route
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            variant="primary"
            leftIcon={<Plus />}
            onClick={() => {
              if (activeTab === 'territories') {
                setEditingTerritory(null);
                setTerritoryForm({ name: '', code: '', description: '', isActive: true });
                setTerritoryModal(true);
              } else {
                setEditingRoute(null);
                setRouteForm({ zoneId: '', name: '', code: '', areas: '', daysOfWeek: [], assignedSRId: '', isActive: true });
                setRouteModal(true);
              }
            }}
          >
            {activeTab === 'territories' ? 'New Territory' : 'New Route'}
          </Button>
        )}
      </div>

      <Tabs tabs={tabDefs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

      {/* ── Territories ── */}
      {activeTab === 'territories' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {territoriesLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Territory</th>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-right">Routes</th>
                  <th className="px-5 py-3 text-right">Shops</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {territories.map((t) => (
                  <tr key={idOf(t)} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{t.name}</p>
                      {t.description && <p className="text-[11px] text-slate-500">{t.description}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{t.code}</td>
                    <td className="px-5 py-3.5 text-right text-slate-300">{t.routeCount ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-slate-300">{t.customerCount ?? 0}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={t.isActive ? 'success' : 'danger'} size="sm">
                        {t.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                            title="Edit"
                            onClick={() => openEditTerritory(t)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {t.isActive && (
                            <button
                              className="p-1.5 text-amber-400 hover:bg-slate-800 rounded-lg"
                              title="Archive territory"
                              onClick={() => archive.mutate({ kind: 'zones', id: idOf(t) })}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {territories.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="px-5 py-8 text-center text-slate-500">
                      No territories yet — create one to start grouping routes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Routes ── */}
      {activeTab === 'routes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {routesLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Route</th>
                  <th className="px-5 py-3 text-left">Territory</th>
                  <th className="px-5 py-3 text-left">Service days</th>
                  <th className="px-5 py-3 text-left">SR</th>
                  <th className="px-5 py-3 text-right">Shops</th>
                  <th className="px-5 py-3 text-right">Due</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {routes.map((r) => (
                  <tr key={idOf(r)} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{r.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.code}
                        {r.areas ? ` • ${r.areas}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{r.zoneId?.name || '—'}</td>
                    <td className="px-5 py-3.5">
                      {(r.daysOfWeek || []).length === 0 ? (
                        <span className="text-[11px] text-slate-500">Not set</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(r.daysOfWeek || []).map((d) => (
                            <span
                              key={d}
                              className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300"
                            >
                              {d.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {r.assignedSRId?.name || <span className="text-[11px] text-slate-500">unassigned</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-300">
                      <button
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        onClick={() => setCustomersFor(r)}
                      >
                        <Users className="w-3.5 h-3.5" /> {r.customerCount ?? 0}
                      </button>
                    </td>
                    <td className={`px-5 py-3.5 text-right ${(r.dueTotal || 0) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {money(r.dueTotal || 0)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={r.isActive ? 'success' : 'danger'} size="sm">
                        {r.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                          title="View shops"
                          onClick={() => setCustomersFor(r)}
                        >
                          <Store className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                              title="Edit"
                              onClick={() => openEditRoute(r)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {r.isActive && (
                              <button
                                className="p-1.5 text-amber-400 hover:bg-slate-800 rounded-lg"
                                title="Archive route"
                                onClick={() => archive.mutate({ kind: 'routes', id: idOf(r) })}
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {routes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                      No routes yet — a route is the beat an SR covers on its service days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Territory modal */}
      <Modal
        isOpen={territoryModal}
        onClose={() => setTerritoryModal(false)}
        title={editingTerritory ? 'Edit Territory' : 'New Territory'}
        size="sm"
      >
        <div className="space-y-3">
          <Input
            placeholder="Name (e.g. Dhaka North)"
            value={territoryForm.name}
            onChange={(e: any) => setTerritoryForm({ ...territoryForm, name: e.target.value })}
          />
          <Input
            placeholder="Code (e.g. DHK-N)"
            value={territoryForm.code}
            disabled={!!editingTerritory}
            onChange={(e: any) => setTerritoryForm({ ...territoryForm, code: e.target.value })}
          />
          <Input
            placeholder="Description (optional)"
            value={territoryForm.description}
            onChange={(e: any) => setTerritoryForm({ ...territoryForm, description: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={territoryForm.isActive}
              onChange={(e) => setTerritoryForm({ ...territoryForm, isActive: e.target.checked })}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTerritoryModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveTerritory.isPending}
              disabled={!territoryForm.name || !territoryForm.code}
              onClick={() => saveTerritory.mutate()}
            >
              {editingTerritory ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Route modal */}
      <Modal
        isOpen={routeModal}
        onClose={() => setRouteModal(false)}
        title={editingRoute ? 'Edit Route' : 'New Route'}
        size="sm"
      >
        <div className="space-y-3">
          <select
            value={routeForm.zoneId}
            onChange={(e: any) => setRouteForm({ ...routeForm, zoneId: e.target.value })}
            className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="">Select territory</option>
            {territories
              .filter((t) => t.isActive || idOf(t) === routeForm.zoneId)
              .map((t) => (
                <option key={idOf(t)} value={idOf(t)}>
                  {t.name}
                </option>
              ))}
          </select>
          <Input
            placeholder="Route name (e.g. Mirpur Beat 1)"
            value={routeForm.name}
            onChange={(e: any) => setRouteForm({ ...routeForm, name: e.target.value })}
          />
          <Input
            placeholder="Code (e.g. MRP-1)"
            value={routeForm.code}
            disabled={!!editingRoute}
            onChange={(e: any) => setRouteForm({ ...routeForm, code: e.target.value })}
          />
          <Input
            placeholder="Areas (comma separated)"
            value={routeForm.areas}
            onChange={(e: any) => setRouteForm({ ...routeForm, areas: e.target.value })}
          />

          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 mb-2">
              <CalendarDays className="w-3.5 h-3.5" /> Service days
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((day) => {
                const on = routeForm.daysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] transition ${
                      on
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <select
            value={routeForm.assignedSRId}
            onChange={(e: any) => setRouteForm({ ...routeForm, assignedSRId: e.target.value })}
            className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="">Assign SR (optional)</option>
            {reps.map((r) => (
              <option key={idOf(r)} value={idOf(r)}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={routeForm.isActive}
              onChange={(e) => setRouteForm({ ...routeForm, isActive: e.target.checked })}
            />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRouteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveRoute.isPending}
              disabled={!routeForm.zoneId || !routeForm.name || !routeForm.code}
              onClick={() => saveRoute.mutate()}
            >
              {editingRoute ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Shops on a route — the SR's call list */}
      <Modal
        isOpen={!!customersFor}
        onClose={() => setCustomersFor(null)}
        title={customersFor ? `Shops on ${customersFor.name}` : 'Shops'}
      >
        {customersLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <RouteIcon className="w-3.5 h-3.5" /> {customersFor?.zoneId?.name || '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />{' '}
                {(customersFor?.daysOfWeek || []).join(', ') || 'no service days set'}
              </span>
            </div>
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
              {routeCustomers.map((c: any) => (
                <div key={idOf(c)} className="px-4 py-2.5 flex items-center justify-between bg-slate-950/40">
                  <div>
                    <p className="text-sm text-white">{c.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.phone} • {c.customerType || 'RETAIL'}
                      {c.assignedSRId?.name ? ` • SR: ${c.assignedSRId.name}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs ${c.currentDueBalance > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {money(c.currentDueBalance || 0)}
                  </span>
                </div>
              ))}
              {routeCustomers.length === 0 && (
                <p className="px-4 py-6 text-center text-slate-500 text-sm">No shops on this route yet.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
