'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { useToast } from './ui/Toast';

/**
 * Header dropdown that moves the session to another organization. Members see
 * their own memberships; the platform Super Admin additionally reaches any
 * organization through the Organizations page (Enter).
 */
export const OrgSwitcher: React.FC = () => {
  const { user, switchOrganization } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const memberships = (user?.memberships || []).filter((m) => m.isActive);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Nothing to switch between — hide entirely (single-org users)
  if (!user || memberships.length < 2) return null;

  const handleSwitch = async (orgId: string) => {
    if (orgId === user.activeOrgId || switching) return;
    setSwitching(orgId);
    try {
      await switchOrganization(orgId);
      toast.success('Organization switched');
      setOpen(false);
      // Org-scoped pages re-fetch from the cleared query cache; land on the
      // dashboard for the new organization.
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Could not switch organization');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900 hover:bg-slate-800 transition-colors focus:outline-none"
        title="Switch organization"
      >
        <Building2 className="w-4 h-4 text-cyan-400" />
        <span className="hidden md:inline text-xs font-semibold text-white max-w-[120px] truncate">
          {user?.orgName || 'Select organization'}
        </span>
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-scale-in">
          <div className="p-3 border-b border-slate-800 bg-slate-950/40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Your organizations
            </p>
          </div>
          <div className="p-1 space-y-0.5 max-h-72 overflow-y-auto">
            {memberships.map((m) => (
              <button
                key={m.orgId}
                type="button"
                onClick={() => handleSwitch(m.orgId)}
                disabled={switching !== null}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors disabled:opacity-60',
                  m.orgId === user.activeOrgId
                    ? 'bg-slate-800/80'
                    : 'hover:bg-slate-800'
                )}
              >
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-white truncate">{m.orgName}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{m.roleName.replace('_', ' ')}</span>
                </span>
                {m.orgId === user.activeOrgId && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
