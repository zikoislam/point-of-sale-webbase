'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { uploadImage } from '../lib/upload';
import {
  Menu,
  Lock,
  LogOut,
  ShoppingCart,
  User,
  Clock,
  ChevronDown,
  Shield,
  Circle,
  Camera,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, lockTerminal, refreshUser } = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Profile picture modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const openProfile = () => {
    setUserDropdownOpen(false);
    setAvatarPreview(user?.avatarUrl || '');
    setAvatarFile(null);
    setAvatarError('');
    setProfileOpen(true);
  };

  const handleAvatarSave = async () => {
    if (!avatarFile) {
      setProfileOpen(false);
      return;
    }
    setAvatarSaving(true);
    setAvatarError('');
    try {
      const url = await uploadImage(avatarFile, 'avatar');
      await api.patch('/users/me/profile', { avatarUrl: url });
      await refreshUser();
      setProfileOpen(false);
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to update profile picture');
    } finally {
      setAvatarSaving(false);
    }
  };

  // Live date & time display (updating every second/minute)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setCurrentDateTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000 * 30); // every 30s
    return () => clearInterval(interval);
  }, []);

  // Global Ctrl+L hotkey for locking terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        lockTerminal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockTerminal]);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Query active shift status
  const { data: shiftData } = useQuery({
    queryKey: ['active-shift'],
    queryFn: async () => {
      try {
        const res = await api.get('/shifts/active');
        return res?.data;
      } catch {
        return null;
      }
    },
    enabled: !!user, // only run when user is authenticated
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false, // don't retry on 404/403
  });

  const hasActiveShift = Boolean(shiftData && shiftData.status === 'OPEN');

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'BRANCH_MANAGER':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'CASHIER':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  // Convert pathname to clean title
  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/pos') return 'Point of Sale';
    const segment = pathname.split('/')[1] || '';
    return segment.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <header className="h-[65px] bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 gap-4 sticky top-0 z-30 select-none">
      {/* Left: Mobile menu toggle + Live Clock */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg lg:hidden transition-colors"
          aria-label="Toggle sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{currentDateTime || 'Loading...'}</span>
        </div>
      </div>

      {/* Center: Breadcrumb / Page Title */}
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-slate-200 tracking-wide">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Quick actions, shift badge, notifications, and user profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Active Shift Indicator Badge */}
        <Link
          href="/shifts"
          className={cn(
            'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
            hasActiveShift
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
          )}
          title={hasActiveShift ? 'Shift is open and active' : 'No active shift'}
        >
          <Circle
            className={cn(
              'w-2 h-2 fill-current',
              hasActiveShift ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
            )}
          />
          <span>{hasActiveShift ? 'Shift Open' : 'No Shift'}</span>
        </Link>

        {/* POS Shortcut (if permitted and not already on /pos) */}
        {pathname !== '/pos' && (
          <Link
            href="/pos"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            title="Open POS Terminal (F9)"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Open POS</span>
          </Link>
        )}

        {/* Real-time Notifications Bell */}
        <NotificationBell />

        {/* Quick Lock Terminal Button (Ctrl+L) */}
        <button
          type="button"
          onClick={() => lockTerminal()}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors relative group"
          title="Lock Terminal (Ctrl+L)"
          aria-label="Lock terminal"
        >
          <Lock className="w-5 h-5" />
          <span className="sr-only">Lock Terminal</span>
        </button>

        {/* Exit — sign out and return to a fresh login page */}
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-colors"
          title="Sign out and return to the login page"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exit</span>
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-800 hover:opacity-90 transition-opacity focus:outline-none"
          >
            {/* User Avatar */}
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-8 h-8 rounded-xl object-cover shadow-md ring-2 ring-blue-500/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-md ring-2 ring-blue-500/20">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}

            <div className="hidden md:flex flex-col text-left leading-tight">
              <span className="text-xs font-semibold text-white max-w-[110px] truncate">
                {user?.fullName || user?.username}
              </span>
              <span
                className={cn(
                  'text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.2 rounded border w-fit mt-0.5',
                  getRoleBadgeStyle(user?.role)
                )}
              >
                {user?.role ? user.role.replace('_', ' ') : 'User'}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {/* User Menu Dropdown */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-scale-in">
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
                <p className="text-xs font-semibold text-white truncate">{user?.fullName}</p>
                <p className="text-[11px] text-slate-400 truncate">@{user?.username}</p>
                <div className="mt-2">
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border inline-block',
                      getRoleBadgeStyle(user?.role)
                    )}
                  >
                    {user?.role ? user.role.replace('_', ' ') : 'User'}
                  </span>
                </div>
              </div>

              <div className="p-1 space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={openProfile}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
                >
                  <Camera className="w-4 h-4 text-slate-400" />
                  <span>My Profile Picture</span>
                </button>

                <Link
                  href="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Profile & Settings</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    lockTerminal();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Lock Terminal</span>
                  </div>
                  <kbd className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                    Ctrl+L
                  </kbd>
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Profile Picture Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">My Profile Picture</h3>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {avatarError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
                  {avatarError}
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-2xl object-cover ring-2 ring-blue-500/30 bg-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-3xl">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition">
                  <Camera className="w-4 h-4" />
                  <span>Choose image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAvatarFile(file);
                      setAvatarPreview(URL.createObjectURL(file));
                      setAvatarError('');
                    }}
                  />
                </label>
                <p className="text-[11px] text-slate-500">PNG, JPG, WEBP or GIF — max 2 MB</p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAvatarSave}
                  disabled={avatarSaving || !avatarFile}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:cursor-not-allowed text-white transition"
                >
                  {avatarSaving ? 'Uploading...' : 'Save Picture'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
