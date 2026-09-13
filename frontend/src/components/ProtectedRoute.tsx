'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { Lock, KeyRound, ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredPermissions = [],
  allowedRoles = [],
}) => {
  const allPermissions = requiredPermission
    ? [...requiredPermissions, requiredPermission]
    : requiredPermissions;
  const router = useRouter();
  const { user, isLoading, isAuthenticated, isTerminalLocked, unlockTerminal, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  // If loading session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 font-medium">Validating session...</p>
      </div>
    );
  }

  // If not logged in
  if (!isAuthenticated || !user) {
    return null;
  }

  // If terminal is locked
  if (isTerminalLocked) {
    const handleUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!/^\d{4}$/.test(pin)) {
        setPinError('Please enter a valid 4-digit PIN');
        return;
      }
      setIsUnlocking(true);
      setPinError('');
      try {
        await unlockTerminal(pin);
        setPin('');
      } catch (err: any) {
        setPinError(err.message || 'Incorrect PIN');
      } finally {
        setIsUnlocking(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Terminal Locked</h2>
          <p className="text-sm text-slate-400 mb-6">
            Signed in as <span className="font-semibold text-slate-200">{user.fullName}</span> ({user.username}).
            Enter your 4-digit PIN to resume.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center text-3xl tracking-[0.5em] font-mono py-3 px-4 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <KeyRound className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
              {pinError && <p className="text-rose-400 text-xs mt-2 font-medium">{pinError}</p>}
            </div>

            <button
              type="submit"
              disabled={isUnlocking || pin.length !== 4}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Unlocking...
                </>
              ) : (
                'Unlock Terminal'
              )}
            </button>

            <button
              type="button"
              onClick={() => logout().then(() => router.replace('/login'))}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors pt-2 block mx-auto"
            >
              Switch Account / Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Check role restrictions
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
        <p className="text-slate-400 max-w-md mb-6">
          Your assigned role ({user.role}) does not have permission to view this section.
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Check permission restrictions
  if (allPermissions.length > 0 && user.role !== 'SUPER_ADMIN') {
    const hasAll = allPermissions.every((perm) => user.permissions.includes(perm));
    if (!hasAll) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Insufficient Permissions</h2>
          <p className="text-slate-400 max-w-md mb-6">
            You lack one or more required privileges to access this feature.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"
          >
            Go Back
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
};
