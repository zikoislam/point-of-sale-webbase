'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Plus, Check, RefreshCw, Lock, Pencil } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/ui/Toast';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { PERMISSION_GROUPS } from '../../../lib/permissions';

interface Role {
  id: string;
  name: string;
  displayName: string;
  permissions: string[];
  isSystemRole: boolean;
  orgId?: string;
  createdAt: string;
}

const getPermBadgeColor = (hasPermission: boolean) =>
  hasPermission
    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20'
    : 'bg-slate-800/50 text-slate-600 border-slate-700/50';

export default function RolesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editing, setEditing] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const myPermissions = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.get<Role[]>('/roles');
      if (Array.isArray(res.data)) {
        setRoles(res.data);
        setSelectedRole((prev) => prev ? res.data!.find((r) => r.id === prev.id) || res.data![0] || null : res.data![0] || null);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const startEditing = () => {
    if (!selectedRole) return;
    setEditing([...selectedRole.permissions]);
  };

  const savePermissions = async () => {
    if (!selectedRole || !editing) return;
    setSaving(true);
    try {
      await api.put(`/roles/${selectedRole.id}`, { permissions: editing });
      toast.success('Role permissions updated');
      setEditing(null);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    setCreating(true);
    try {
      await api.post('/roles', {
        name: newName.trim().toUpperCase().replace(/\s+/g, '_'),
        displayName: newDisplayName.trim() || newName.trim(),
        permissions: newPerms,
      });
      toast.success('Role created');
      setCreateOpen(false);
      setNewName(''); setNewDisplayName(''); setNewPerms([]);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // A role is editable when it belongs to an org. The platform super admin may
  // also edit the platform templates — that only changes what NEW organizations
  // are provisioned with; existing organizations keep their own role copies.
  const canEditSelected = !!selectedRole && (!!selectedRole.orgId || isSuper);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Role Management
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Grant permissions you hold — nobody can elevate beyond their own access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw className={loading ? 'animate-spin' : ''} />} onClick={fetchRoles}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
            New Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
            ))
          ) : (
            roles.map((role) => (
              <button
                key={role.id}
                onClick={() => { setSelectedRole(role); setEditing(null); }}
                className={`
                  w-full text-left p-4 rounded-xl border transition-all
                  ${selectedRole?.id === role.id
                    ? 'bg-indigo-600/10 border-indigo-500/30 shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }
                `}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedRole?.id === role.id ? 'bg-indigo-600/20' : 'bg-slate-800'}`}>
                    <Shield className={`w-4 h-4 ${selectedRole?.id === role.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${selectedRole?.id === role.id ? 'text-indigo-300' : 'text-white'}`}>
                      {role.displayName}
                    </p>
                    <p className="text-xs text-slate-500">{role.permissions.length} permissions</p>
                  </div>
                  {!role.orgId && (
                    <span className="ml-auto text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-medium">SYS</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Permissions Matrix */}
        <div className="lg:col-span-3">
          {selectedRole ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">{selectedRole.displayName}</h2>
                  <p className="text-xs text-slate-500">{editing ? `Editing — ${editing.length} selected` : `${selectedRole.permissions.length} active permissions`}</p>
                </div>
                {editing !== null ? (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button variant="primary" size="sm" loading={saving} onClick={savePermissions}>Save</Button>
                  </div>
                ) : canEditSelected ? (
                  <Button variant="outline" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={startEditing}>
                    Edit permissions
                  </Button>
                ) : (
                  <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Platform template — read only
                  </span>
                )}
              </div>

              <div className="p-5 space-y-6">
                {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                  <div key={group}>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{group}</h3>
                    <div className="flex flex-wrap gap-2">
                      {perms.map((perm) => {
                        if (editing !== null) {
                          const on = editing.includes(perm);
                          const grantable = isSuper || myPermissions.includes(perm);
                          return (
                            <label
                              key={perm}
                              title={grantable ? undefined : 'You do not hold this permission yourself'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                                on
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                                  : grantable
                                    ? 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
                                    : 'bg-slate-900 text-slate-700 border-slate-800 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="accent-emerald-500 w-3 h-3"
                                checked={on}
                                disabled={!grantable || saving}
                                onChange={() =>
                                  setEditing(on ? editing.filter((p) => p !== perm) : [...editing, perm])
                                }
                              />
                              {perm}
                              {!grantable && <Lock className="w-3 h-3" />}
                            </label>
                          );
                        }
                        const has = selectedRole.permissions.includes(perm);
                        return (
                          <span
                            key={perm}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${getPermBadgeColor(has)}`}
                          >
                            {has && <Check className="w-3 h-3" />}
                            {perm}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl h-48 flex items-center justify-center text-slate-500">
              Select a role to view permissions
            </div>
          )}
        </div>
      </div>

      {/* Create role modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Role"
        subtitle="Only permissions you hold yourself can be granted"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Role name (system key)</label>
              <Input value={newName} onChange={(e: any) => setNewName(e.target.value)} placeholder="e.g. SALES_STAFF" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Display name</label>
              <Input value={newDisplayName} onChange={(e: any) => setNewDisplayName(e.target.value)} placeholder="e.g. Sales Staff" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Permissions</label>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <div key={group}>
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{group}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((perm) => {
                      const on = newPerms.includes(perm);
                      const grantable = isSuper || myPermissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          title={grantable ? undefined : 'You do not hold this permission yourself'}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                            on
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                              : grantable
                                ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                                : 'bg-slate-900 border-slate-800 text-slate-700 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-emerald-500 w-3 h-3"
                            checked={on}
                            disabled={!grantable || creating}
                            onChange={() => setNewPerms(on ? newPerms.filter((p) => p !== perm) : [...newPerms, perm])}
                          />
                          {perm}
                          {!grantable && <Lock className="w-3 h-3" />}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} disabled={!newName.trim()} onClick={createRole}>
              Create Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
