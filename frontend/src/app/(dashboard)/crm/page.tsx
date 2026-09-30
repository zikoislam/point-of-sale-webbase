'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, ClipboardCheck, Megaphone, Plus, RefreshCw, Check, X, Users, Award, Settings } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../hooks/useAuth';

interface LoyaltyConfigData { id: string; pointsPerTk: number; redeemValuePerPoint: number; minPointsToRedeem: number; isActive: boolean; }
interface LoyaltyRow { _id: string; name: string; phone: string; loyaltyPoints: number; customerType?: string; }
interface ActivityRow { id: string; type: string; subject: string; notes?: string; status: string; dueDate?: string; createdAt: string; customerId?: any; assignedToUserId?: any; }
interface CampaignRow { id: string; name: string; channel: string; status: string; audienceCount: number; startsAt: string; message?: string; segment: any; }
interface CustomerOption { _id?: string; id?: string; name: string }

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);

export default function CrmPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const has = (p: string) => isSuper || perms.includes(p);

  const [activeTab, setActiveTab] = useState('loyalty');
  const [loyaltyForm, setLoyaltyForm] = useState<{ pointsPerTk: number; redeemValuePerPoint: number; minPointsToRedeem: number; isActive: boolean } | null>(null);
  const [activityModal, setActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ customerId: '', type: 'CALL', subject: '', notes: '', dueDate: '' });
  const [campaignModal, setCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', channel: 'SMS', customerType: '', minPurchases: '', minSpend: '', message: '' });

  const canView = has('crm:view');
  const canManage = has('crm:manage');

  const { data: loyalty } = useQuery<LoyaltyConfigData>({
    queryKey: ['crm-loyalty'],
    queryFn: async () => (await api.get('/crm/loyalty')).data,
    enabled: canView,
  });
  const { data: loyaltyRows = [] } = useQuery<LoyaltyRow[]>({
    queryKey: ['crm-loyalty-report'],
    queryFn: async () => (await api.get('/crm/loyalty/report')).data || [],
    enabled: canView,
  });
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityRow[]>({
    queryKey: ['crm-activities'],
    queryFn: async () => (await api.get('/crm/activities')).data || [],
    enabled: canView,
  });
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<CampaignRow[]>({
    queryKey: ['crm-campaigns'],
    queryFn: async () => (await api.get('/crm/campaigns')).data || [],
    enabled: canView,
  });
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['crm-customers'],
    queryFn: async () => {
      const res = await api.get('/customers?limit=100');
      return Array.isArray(res.data) ? res.data : res.data?.customers || [];
    },
    enabled: canManage,
  });

  React.useEffect(() => {
    if (loyalty && !loyaltyForm) {
      setLoyaltyForm({
        pointsPerTk: loyalty.pointsPerTk,
        redeemValuePerPoint: loyalty.redeemValuePerPoint,
        minPointsToRedeem: loyalty.minPointsToRedeem,
        isActive: loyalty.isActive,
      });
    }
  }, [loyalty, loyaltyForm]);

  const invalidate = () => ['crm-loyalty', 'crm-loyalty-report', 'crm-activities', 'crm-campaigns'].forEach((k) =>
    queryClient.invalidateQueries({ queryKey: [k] })
  );

  const createActivity = useMutation({
    mutationFn: async () => {
      await api.post('/crm/activities', {
        ...activityForm,
        dueDate: activityForm.dueDate ? new Date(activityForm.dueDate).toISOString() : undefined,
      });
    },
    onSuccess: () => { toast.success('Follow-up created'); setActivityModal(false); setActivityForm({ customerId: '', type: 'CALL', subject: '', notes: '', dueDate: '' }); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const activityStatus = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'DONE' | 'REOPEN' }) => { await api.patch(`/crm/activities/${id}/status`, { action }); },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });
  const createCampaign = useMutation({
    mutationFn: async () => {
      await api.post('/crm/campaigns', {
        name: campaignForm.name,
        channel: campaignForm.channel,
        message: campaignForm.message || undefined,
        segment: {
          customerType: campaignForm.customerType || undefined,
          minPurchases: campaignForm.minPurchases ? Number(campaignForm.minPurchases) : undefined,
          minSpend: campaignForm.minSpend ? Number(campaignForm.minSpend) : undefined,
        },
      });
    },
    onSuccess: () => { toast.success('Campaign created'); setCampaignModal(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const campaignStatus = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'RUN' | 'COMPLETE' | 'CANCEL' }) => { await api.patch(`/crm/campaigns/${id}/status`, { action }); },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  const tabDefs = [
    { key: 'loyalty', label: 'Loyalty' },
    { key: 'activities', label: 'Follow-ups', count: activities.filter((a) => a.status === 'OPEN').length },
    { key: 'campaigns', label: 'Campaigns', count: campaigns.length },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">CRM</h1>
            <p className="text-sm text-slate-400">Loyalty program, customer follow-ups and marketing campaigns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button variant="outline" size="sm" leftIcon={<ClipboardCheck />} onClick={() => setActivityModal(true)}>New Follow-up</Button>
              <Button variant="primary" size="sm" leftIcon={<Megaphone />} onClick={() => setCampaignModal(true)}>New Campaign</Button>
            </>
          )}
        </div>
      </div>

      <Tabs tabs={tabDefs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

      {/* Loyalty */}
      {activeTab === 'loyalty' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Program settings
            </h3>
            <p className="text-xs text-slate-400">
              Earning rate, redemption limits, expiry and the tier ladder now live on their own page so the same
              rules are never edited in two places.
            </p>
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 space-y-1">
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Points per ৳1</span>
                <strong className="text-white">{loyaltyForm?.pointsPerTk ?? '—'}</strong>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-slate-500">৳ per point</span>
                <strong className="text-white">{loyaltyForm?.redeemValuePerPoint ?? '—'}</strong>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Min redeem</span>
                <strong className="text-white">{loyaltyForm?.minPointsToRedeem ?? '—'}</strong>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <strong className={loyaltyForm?.isActive ? 'text-emerald-400' : 'text-rose-400'}>
                  {loyaltyForm?.isActive ? 'Active' : 'Paused'}
                </strong>
              </p>
            </div>
            <Link href="/settings/loyalty">
              <Button variant="primary" size="sm" leftIcon={<Settings className="w-3.5 h-3.5" />} className="w-full">
                Open programme settings
              </Button>
            </Link>
            <Link href="/reports/loyalty" className="block text-center text-[11px] text-blue-400 hover:text-blue-300">
              View loyalty analytics →
            </Link>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Top point holders</span>
              <Button variant="outline" size="sm" leftIcon={<RefreshCw />} onClick={() => invalidate()}>Refresh</Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-right">Points</th>
                  <th className="px-5 py-3 text-right">≈ Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loyaltyRows.map((row) => (
                  <tr key={row._id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-white">{row.name} <span className="text-[11px] text-slate-500">{row.phone}</span></td>
                    <td className="px-5 py-3 text-slate-400">{row.customerType || 'RETAIL'}</td>
                    <td className="px-5 py-3 text-right text-white font-semibold">{row.loyaltyPoints}</td>
                    <td className="px-5 py-3 text-right text-emerald-400">{money(row.loyaltyPoints * (loyalty?.redeemValuePerPoint || 0))}</td>
                  </tr>
                ))}
                {loyaltyRows.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No points earned yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activities */}
      {activeTab === 'activities' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {activitiesLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Subject</th>
                  <th className="px-5 py-3 text-left">Due</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {activities.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 text-white">{a.customerId?.name || '—'}</td>
                    <td className="px-5 py-3.5"><Badge variant="info" size="sm">{a.type}</Badge></td>
                    <td className="px-5 py-3.5 text-slate-300">{a.subject}</td>
                    <td className="px-5 py-3.5 text-slate-400">{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3.5"><Badge variant={a.status === 'OPEN' ? 'warning' : 'success'} size="sm">{a.status}</Badge></td>
                    <td className="px-5 py-3.5 text-right">
                      {canManage && (
                        a.status === 'OPEN' ? (
                          <button className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg" title="Mark done" onClick={() => activityStatus.mutate({ id: a.id, action: 'DONE' })}>
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button className="p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg" title="Reopen" onClick={() => activityStatus.mutate({ id: a.id, action: 'REOPEN' })}>
                            <X className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {activities.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No follow-ups yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaignsLoading && <div className="col-span-full flex justify-center py-10"><Spinner /></div>}
          {campaigns.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.channel} • starts {new Date(c.startsAt).toLocaleDateString()}</p>
                </div>
                <Badge variant={c.status === 'RUNNING' ? 'success' : c.status === 'DRAFT' ? 'info' : c.status === 'COMPLETED' ? 'neutral' : 'danger'} size="sm">{c.status}</Badge>
              </div>
              {c.message && <p className="text-[11px] text-slate-400 bg-slate-800/50 rounded-lg p-2">{c.message}</p>}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Audience: <strong className="text-slate-300">{c.audienceCount}</strong></span>
                {canManage && c.status === 'DRAFT' && (
                  <div className="flex gap-1.5">
                    <Button variant="primary" size="sm" onClick={() => campaignStatus.mutate({ id: c.id, action: 'RUN' })}>Run</Button>
                    <Button variant="ghost" size="sm" onClick={() => campaignStatus.mutate({ id: c.id, action: 'CANCEL' })}>Cancel</Button>
                  </div>
                )}
                {canManage && c.status === 'RUNNING' && (
                  <Button variant="success" size="sm" onClick={() => campaignStatus.mutate({ id: c.id, action: 'COMPLETE' })}>Complete</Button>
                )}
              </div>
            </div>
          ))}
          {!campaignsLoading && campaigns.length === 0 && (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm">
              No campaigns yet.
            </div>
          )}
        </div>
      )}

      {/* Activity modal */}
      <Modal isOpen={activityModal} onClose={() => setActivityModal(false)} title="New Follow-up" size="sm">
        <div className="space-y-3">
          <select value={activityForm.customerId} onChange={(e: any) => setActivityForm({ ...activityForm, customerId: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">Select customer</option>
            {customers.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
          </select>
          <select value={activityForm.type} onChange={(e: any) => setActivityForm({ ...activityForm, type: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            {['CALL', 'VISIT', 'NOTE', 'TASK', 'COMPLAINT'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input placeholder="Subject" value={activityForm.subject} onChange={(e: any) => setActivityForm({ ...activityForm, subject: e.target.value })} />
          <Input type="date" value={activityForm.dueDate} onChange={(e: any) => setActivityForm({ ...activityForm, dueDate: e.target.value })} />
          <Input placeholder="Notes (optional)" value={activityForm.notes} onChange={(e: any) => setActivityForm({ ...activityForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setActivityModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createActivity.isPending} disabled={!activityForm.customerId || !activityForm.subject} onClick={() => createActivity.mutate()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Campaign modal */}
      <Modal isOpen={campaignModal} onClose={() => setCampaignModal(false)} title="New Campaign" subtitle="The audience is computed from your customer segments" size="md">
        <div className="space-y-3">
          <Input placeholder="Campaign name" value={campaignForm.name} onChange={(e: any) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select value={campaignForm.channel} onChange={(e: any) => setCampaignForm({ ...campaignForm, channel: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
              {['SMS', 'WHATSAPP', 'PHONE', 'EMAIL'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={campaignForm.customerType} onChange={(e: any) => setCampaignForm({ ...campaignForm, customerType: e.target.value })} className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
              <option value="">All customer types</option>
              {['RETAIL', 'WHOLESALE', 'DEALER'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Min purchases" value={campaignForm.minPurchases} onChange={(e: any) => setCampaignForm({ ...campaignForm, minPurchases: e.target.value })} />
            <Input type="number" placeholder="Min spend (৳)" value={campaignForm.minSpend} onChange={(e: any) => setCampaignForm({ ...campaignForm, minSpend: e.target.value })} />
          </div>
          <Input placeholder="Message" value={campaignForm.message} onChange={(e: any) => setCampaignForm({ ...campaignForm, message: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCampaignModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createCampaign.isPending} disabled={!campaignForm.name} onClick={() => createCampaign.mutate()}>Create Campaign</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
