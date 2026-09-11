'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';
import { formatDateTime } from '../../../../lib/utils';
import {
  UserCog,
  ArrowLeft,
  KeyRound,
  Shield,
  Save,
  Trash2,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { useToast } from '../../../../components/ui/Toast';

interface Role {
  _id: string;
  name: string;
  displayName: string;
}

interface UserDetail {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: { _id: string; name: string; displayName: string };
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Security Credentials
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');

  // Fetch User
  const { data: user, isLoading: loadingUser } = useQuery<UserDetail>({
    queryKey: ['user-detail', id],
    queryFn: async () => {
      const res = await api.get(`/users/${id}`);
      return res.data;
    },
  });

  // Fetch Roles
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const res = await api.get('/roles');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRoleId(user.role?._id || '');
      setIsActive(user.isActive !== false);
    }
  }, [user]);

  // Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { fullName, email, phone, roleId, isActive };
      if (newPassword.trim()) payload.password = newPassword.trim();
      return api.put(`/users/${id}`, payload);
    },
    onSuccess: () => {
      success('User profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['user-detail', id] });
      setNewPassword('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update user');
    },
  });

  // Update PIN Mutation
  const pinMutation = useMutation({
    mutationFn: async () => {
      return api.patch(`/users/${id}/pin`, { pin: newPin });
    },
    onSuccess: () => {
      success('POS 4-Digit PIN changed successfully');
      setNewPin('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update PIN');
    },
  });

  if (loadingUser) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
        <p className="text-sm">Loading user account #{id}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <Link href="/users">
            <button
              type="button"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Back to users"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {user?.fullName || 'User Profile'}
              </h1>
              <Badge variant={user?.isActive ? 'success' : 'neutral'}>
                {user?.isActive ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Username: @{user?.username} · Registered: {formatDateTime(user?.createdAt || '')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-3">
          Account Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Role Permission Set
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {roles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.displayName} ({r.name})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="user-active-toggle"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
          />
          <label htmlFor="user-active-toggle" className="text-sm text-slate-200">
            Account Active (User can login and operate assigned terminal)
          </label>
        </div>

        <div className="border-t border-slate-800 pt-4 flex justify-end">
          <Button
            variant="primary"
            leftIcon={<Save className="w-4 h-4" />}
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            Save Profile Changes
          </Button>
        </div>
      </div>

      {/* Reset Password Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Lock className="w-4 h-4 text-amber-400" />
          Reset Password
        </h2>
        <p className="text-xs text-slate-400">
          Enter a new password to reset credentials for this user account.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-80">
            <Input
              label="New Password"
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!newPassword.trim() || newPassword.length < 6}
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            Update Password
          </Button>
        </div>
      </div>

      {/* POS Quick-Unlock PIN Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <KeyRound className="w-4 h-4 text-teal-400" />
          POS Quick-Unlock 4-Digit PIN
        </h2>
        <p className="text-xs text-slate-400">
          Used for lock screen PIN authorization and shift registers.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-60">
            <Input
              label="4-Digit PIN"
              type="password"
              maxLength={4}
              placeholder="e.g. 1234"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={newPin.length !== 4}
            loading={pinMutation.isPending}
            onClick={() => pinMutation.mutate()}
          >
            Update PIN
          </Button>
        </div>
      </div>
    </div>
  );
}
