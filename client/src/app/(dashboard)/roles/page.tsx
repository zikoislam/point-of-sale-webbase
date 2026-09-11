'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Plus, Check, RefreshCw } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface Role {
  id: string;
  name: string;
  displayName: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: string;
}

const authHeader = () => {
  const token = localStorage.getItem('pos_access_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const PERM_GROUPS: Record<string, string[]> = {
  'POS & Sales': ['pos:checkout', 'pos:void', 'sales:view', 'sales:refund'],
  Inventory: ['inv:view', 'inv:manage', 'inv:adjustments'],
  Procurement: ['procurement:view', 'procurement:manage'],
  Customers: ['customers:view', 'customers:manage'],
  Shifts: ['shifts:operate', 'shifts:manage'],
  Finance: ['expenses:view', 'expenses:manage', 'accounts:view', 'accounts:manage'],
  Reports: ['reports:dashboard', 'reports:financial'],
  Administration: ['users:manage', 'roles:view', 'roles:manage', 'settings:manage', 'audit:view'],
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/roles`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) {
        setRoles(json.data);
        if (json.data.length > 0) setSelectedRole(json.data[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const getPermBadgeColor = (hasPermission: boolean) =>
    hasPermission
      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20'
      : 'bg-slate-800/50 text-slate-600 border-slate-700/50';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Role Management
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage access permissions by role</p>
        </div>
        <button onClick={fetchRoles} className="p-2.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
                onClick={() => setSelectedRole(role)}
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
                  {role.isSystemRole && (
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
                  <p className="text-xs text-slate-500">{selectedRole.permissions.length} active permissions</p>
                </div>
                {selectedRole.isSystemRole && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                    System Role — Read Only
                  </span>
                )}
              </div>

              <div className="p-5 space-y-6">
                {Object.entries(PERM_GROUPS).map(([group, perms]) => (
                  <div key={group}>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{group}</h3>
                    <div className="flex flex-wrap gap-2">
                      {perms.map((perm) => {
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
    </div>
  );
}
