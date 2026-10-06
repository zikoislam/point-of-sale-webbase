'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  RefreshCw,
  Shield,
  LogIn,
  Ban,
  CheckCircle2,
  Users as UsersIcon,
  Package,
  Receipt,
  Trash2,
  KeyRound,
  Copy,
  CalendarClock,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Spinner } from '../../../components/ui/Spinner';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';
import { PermissionChecklist } from '../../../components/admin/PermissionChecklist';

interface Org {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  adminPermissionSet: string[];
  memberCount: number;
  createdAt: string;
  subscriptionEndsAt: string | null;
  subscriptionStatus: 'UNLIMITED' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | string;
  subscriptionPlan: string;
  subscriptionGraceDays: number;
  daysRemaining: number | null;
}

interface LicenseKey {
  _id: string;
  key: string;
  days: number;
  plan?: string;
  status: 'ISSUED' | 'REDEEMED' | 'REVOKED';
  machineId?: string;
  note?: string;
  redeemedAt?: string;
  createdAt: string;
}

interface Plan {
  _id: string;
  name: string;
  code: string;
  durationDays: number;
  price: number;
}

function subscriptionBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'GRACE':
      return 'warning';
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatSubscription(endsAt: string | null, status: string): string {
  if (!endsAt) return 'Unlimited';
  const date = new Date(endsAt).toLocaleDateString();
  return status === 'EXPIRED' ? `Expired ${date}` : `Until ${date}`;
}

interface OrgSummaryData {
  org: Org;
  counts: {
    users: number;
    products: number;
    customers: number;
    suppliers: number;
    sales: number;
    purchaseOrders: number;
    expenses: number;
  };
}

export default function OrganizationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Org | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Org | null>(null);
  const [entering, setEntering] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [editPerms, setEditPerms] = useState<string[] | null>(null);

  const [memberUsername, setMemberUsername] = useState('');
  const [memberRoleId, setMemberRoleId] = useState('');

  // Subscription / license issuance
  const [extendDays, setExtendDays] = useState('30');
  const [genDays, setGenDays] = useState('30');
  const [genPlan, setGenPlan] = useState('STANDARD');
  const [genNote, setGenNote] = useState('');
  const [genMachine, setGenMachine] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const isSuper = !!user?.isPlatformSuperAdmin;

  const { data: orgs = [], isLoading, refetch, isRefetching } = useQuery<Org[]>({
    queryKey: ['platform-orgs'],
    queryFn: async () => {
      const res = await api.get('/platform/orgs');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: isSuper,
  });

  const { data: roles = [] } = useQuery<{ id: string; name: string; displayName: string }[]>({
    queryKey: ['platform-org-roles', detail?.id],
    queryFn: async () => {
      const res = await api.get(`/roles`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!detail,
  });

  const { data: summary } = useQuery<OrgSummaryData>({
    queryKey: ['platform-org-summary', detail?.id],
    queryFn: async () => {
      const res = await api.get(`/platform/orgs/${detail!.id}/summary`);
      return res.data;
    },
    enabled: !!detail,
  });

  const { data: licenses = [] } = useQuery<LicenseKey[]>({
    queryKey: ['platform-org-licenses', detail?.id],
    queryFn: async () => {
      const res = await api.get(`/platform/orgs/${detail!.id}/licenses`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!detail,
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: async () => {
      const res = await api.get('/platform/plans');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: isSuper,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-orgs'] });
    if (detail) {
      queryClient.invalidateQueries({ queryKey: ['platform-org-summary', detail.id] });
      queryClient.invalidateQueries({ queryKey: ['platform-org-licenses', detail.id] });
    }
  };

  const createOrg = useMutation({
    mutationFn: async () => {
      await api.post('/platform/orgs', {
        name: newName,
        contactPhone: newPhone || undefined,
        contactEmail: newEmail || undefined,
        address: newAddress || undefined,
        adminPermissionSet: newPerms,
      });
    },
    onSuccess: () => {
      toast.success('Organization created');
      setCreateOpen(false);
      setNewName(''); setNewPhone(''); setNewEmail(''); setNewAddress(''); setNewPerms([]);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePerms = useMutation({
    mutationFn: async () => {
      await api.put(`/platform/orgs/${detail!.id}/permissions`, { adminPermissionSet: editPerms });
    },
    onSuccess: () => {
      toast.success('Permission envelope updated — effective immediately');
      setEditPerms(null);
      invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) => {
      await api.patch(`/platform/orgs/${id}`, { status });
    },
    onSuccess: () => {
      toast.success('Organization updated');
      setSuspendTarget(null);
      refetch();
      if (detail) setDetail(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      await api.post(`/platform/orgs/${detail!.id}/members`, {
        username: memberUsername,
        roleId: memberRoleId,
      });
    },
    onSuccess: () => {
      toast.success('Member added');
      setMemberUsername(''); setMemberRoleId('');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const extendSubscription = useMutation({
    mutationFn: async () => {
      await api.patch(`/platform/orgs/${detail!.id}/subscription`, {
        days: Number(extendDays),
        plan: genPlan || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Subscription extended');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateLicense = useMutation({
    mutationFn: async () => {
      const res = await api.post<LicenseKey>(`/platform/orgs/${detail!.id}/licenses`, {
        days: selectedPlanId ? undefined : Number(genDays),
        planId: selectedPlanId || undefined,
        plan: genPlan || undefined,
        note: genNote || undefined,
        machineId: genMachine || undefined,
      });
      return res.data as LicenseKey;
    },
    onSuccess: (data) => {
      toast.success('License key generated');
      if (data?.key) setGeneratedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['platform-org-licenses', detail!.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const revokeLicense = useMutation({
    mutationFn: async (keyId: string) => {
      await api.post(`/platform/licenses/${keyId}/revoke`);
    },
    onSuccess: () => {
      toast.success('License key revoked');
      queryClient.invalidateQueries({ queryKey: ['platform-org-licenses', detail!.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyGeneratedKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
      toast.success('License key copied');
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  const enterOrg = async (org: Org) => {
    if (entering) return;
    setEntering(org.id);
    try {
      const res = await api.post<{ token: string }>(`/platform/orgs/${org.id}/enter`);
      if (res.data?.token) {
        sessionStorage.setItem('pos_token', res.data.token);
        queryClient.clear();
        toast.success(`Working inside "${org.name}"`);
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEntering(null);
    }
  };

  if (!isSuper) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Only the platform Super Admin can manage organizations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Organizations</h1>
            <p className="text-sm text-slate-400">
              One software, many organizations — set each org&apos;s permission envelope and enter it to work inside.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
            New Organization
          </Button>
        </div>
      </div>

      {/* Org cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : orgs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-sm">
          No organizations yet. Create the first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <div key={org.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">/{org.slug}</p>
                  </div>
                </div>
                <Badge variant={org.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">{org.status}</Badge>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" /> {org.memberCount} member{org.memberCount === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> {org.adminPermissionSet.length} permissions</span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <Badge variant={subscriptionBadgeVariant(org.subscriptionStatus)} size="sm">
                  {org.subscriptionStatus}
                </Badge>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {formatSubscription(org.subscriptionEndsAt, org.subscriptionStatus)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-1">
                <Button variant="primary" size="sm" leftIcon={<LogIn className="w-3.5 h-3.5" />} loading={entering === org.id} onClick={() => enterOrg(org)}>
                  Enter
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDetail(org)}>
                  Manage
                </Button>
                {org.status === 'ACTIVE' ? (
                  <Button variant="danger" size="sm" leftIcon={<Ban className="w-3.5 h-3.5" />} onClick={() => setSuspendTarget(org)}>
                    Suspend
                  </Button>
                ) : (
                  <Button variant="success" size="sm" leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => setStatus.mutate({ id: org.id, status: 'ACTIVE' })}>
                    Activate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Organization"
        subtitle="Creates per-org settings, roles, chart of accounts and expense categories"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400">Organization name *</label>
            <Input value={newName} onChange={(e: any) => setNewName(e.target.value)} placeholder="e.g. Rahim Traders" className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Phone</label>
              <Input value={newPhone} onChange={(e: any) => setNewPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Email</label>
              <Input value={newEmail} onChange={(e: any) => setNewEmail(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">Address</label>
            <Input value={newAddress} onChange={(e: any) => setNewAddress(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              Permission envelope — the ceiling for everyone inside this organization
            </label>
            <PermissionChecklist selected={newPerms} onChange={setNewPerms} disabled={createOrg.isPending} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={createOrg.isPending} disabled={!newName.trim()} onClick={() => createOrg.mutate()}>
              Create Organization
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage modal */}
      <Modal
        isOpen={!!detail}
        onClose={() => { setDetail(null); setEditPerms(null); }}
        title={detail?.name || ''}
        subtitle={detail ? `/${detail.slug}` : ''}
        size="lg"
      >
        {detail && (
          <div className="space-y-5">
            {/* summary counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {summary && (
                <>
                  {[
                    { label: 'Members', value: summary.counts.users, icon: UsersIcon },
                    { label: 'Products', value: summary.counts.products, icon: Package },
                    { label: 'Customers', value: summary.counts.customers, icon: UsersIcon },
                    { label: 'Sales', value: summary.counts.sales, icon: Receipt },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                      <Icon className="w-4 h-4 text-slate-500 mb-1" />
                      <p className="text-lg font-bold text-white leading-none">{value}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">{label}</p>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* subscription & licenses */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wide inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Subscription &amp; Licenses
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant={subscriptionBadgeVariant(detail.subscriptionStatus)} size="sm">
                    {detail.subscriptionStatus}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    {formatSubscription(detail.subscriptionEndsAt, detail.subscriptionStatus)}
                  </span>
                </div>
              </div>

              {/* Direct extension (manual payment) */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-28">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Extend days</label>
                  <Input
                    value={extendDays}
                    onChange={(e: any) => setExtendDays(e.target.value.replace(/\D/g, ''))}
                    className="mt-1"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={extendSubscription.isPending}
                  disabled={!extendDays}
                  onClick={() => extendSubscription.mutate()}
                >
                  Extend subscription
                </Button>
              </div>

              {/* Generate a redeemable key */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Key days</label>
                  <Input
                    value={genDays}
                    onChange={(e: any) => setGenDays(e.target.value.replace(/\D/g, ''))}
                    className="mt-1"
                    disabled={!!selectedPlanId}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Plan</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e: any) => {
                      const id = e.target.value;
                      setSelectedPlanId(id);
                      const plan = plans.find((p) => p._id === id);
                      if (plan) {
                        setGenDays(String(plan.durationDays));
                        setGenPlan(plan.name);
                      }
                    }}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Manual (use days)</option>
                    {plans.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · {p.durationDays}d{p.price ? ` · ৳${p.price}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Label</label>
                  <Input value={genPlan} onChange={(e: any) => setGenPlan(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Machine ID</label>
                  <Input
                    value={genMachine}
                    onChange={(e: any) => setGenMachine(e.target.value.toUpperCase())}
                    placeholder="optional"
                    className="mt-1"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  loading={generateLicense.isPending}
                  disabled={!genDays}
                  onClick={() => generateLicense.mutate()}
                >
                  Generate key
                </Button>
              </div>
              <Input
                value={genNote}
                onChange={(e: any) => setGenNote(e.target.value)}
                placeholder="Note (optional)"
              />

              {generatedKey && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <code className="font-mono text-sm text-emerald-300">{generatedKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={copyGeneratedKey}
                  >
                    Copy
                  </Button>
                </div>
              )}

              {/* Issued keys */}
              <div className="space-y-1.5">
                {licenses.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No license keys issued yet.</p>
                ) : (
                  licenses.map((k) => (
                    <div
                      key={k._id}
                      className="flex items-center justify-between gap-2 text-[11px] bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2"
                    >
                      <code className="font-mono text-slate-300">{k.key}</code>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">
                          {k.days}d{k.plan ? ` · ${k.plan}` : ''}
                        </span>
                        <Badge
                          variant={k.status === 'ISSUED' ? 'info' : k.status === 'REDEEMED' ? 'success' : 'danger'}
                          size="sm"
                        >
                          {k.status}
                        </Badge>
                        {k.status === 'ISSUED' && (
                          <button
                            type="button"
                            className="text-rose-400 hover:text-rose-300 disabled:opacity-50"
                            disabled={revokeLicense.isPending}
                            onClick={() => revokeLicense.mutate(k._id)}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* permission envelope */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wide">Permission envelope</h4>
                {editPerms === null && (
                  <Button variant="outline" size="sm" onClick={() => setEditPerms([...detail.adminPermissionSet])}>
                    Edit envelope
                  </Button>
                )}
              </div>
              {editPerms === null ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.adminPermissionSet.length === 0 && (
                    <p className="text-xs text-slate-500">No permissions granted — nobody inside this org can work.</p>
                  )}
                  {detail.adminPermissionSet.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] text-slate-300">{p}</span>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <PermissionChecklist selected={editPerms} onChange={setEditPerms} disabled={updatePerms.isPending} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditPerms(null)}>Cancel</Button>
                    <Button variant="primary" size="sm" loading={updatePerms.isPending} onClick={() => updatePerms.mutate()}>
                      Save envelope
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* members */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wide">Add existing user as member</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={memberUsername} onChange={(e: any) => setMemberUsername(e.target.value)} placeholder="username or email" />
                <select
                  value={memberRoleId}
                  onChange={(e: any) => setMemberRoleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">Select org role</option>
                  {roles
                    .filter((r: any) => r.orgId === detail.id)
                    .map((r: any) => (
                      <option key={r.id} value={r.id}>{r.displayName}</option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" size="sm" loading={addMember.isPending} disabled={!memberUsername.trim() || !memberRoleId} onClick={() => addMember.mutate()}>
                  Add member
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => { setSuspendTarget(detail); }}
                disabled={detail.status === 'SUSPENDED'}
              >
                Suspend organization
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={() => suspendTarget && setStatus.mutate({ id: suspendTarget.id, status: 'SUSPENDED' })}
        title="Suspend organization"
        description={`All users of "${suspendTarget?.name}" lose access immediately until re-activated.`}
        confirmText="Suspend"
        variant="danger"
        loading={setStatus.isPending}
      />
    </div>
  );
}
