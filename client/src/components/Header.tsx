'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import {
  Menu, Bell, LogOut, Lock, User, ChevronDown, Store, AlertTriangle, Info, Check, Trash2, X
} from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarCollapsed }) => {
  const router = useRouter();
  const { user, logout, lockTerminal } = useAuth();
  const { alerts, unreadCount, markAllAsRead, clearAlerts } = useRealTimeNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleLock = async () => {
    await lockTerminal();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'BRANCH_MANAGER': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CASHIER': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <header className="h-[65px] bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4 gap-4 sticky top-0 z-30">
      {/* Left: Menu toggle */}
      <button
        onClick={onMenuClick}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center: Spacer */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="flex items-center gap-2 relative">
        {/* Real-time Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications && unreadCount > 0) {
                markAllAsRead();
              }
            }}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-xs text-white">Live System Alerts</span>
                </div>
                {alerts.length > 0 && (
                  <button
                    onClick={clearAlerts}
                    className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto p-2 space-y-1.5">
                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No active notifications or alerts.
                  </div>
                ) : (
                  alerts.map((a) => (
                    <div
                      key={a.id}
                      className={`p-2.5 rounded-xl border text-xs transition ${
                        a.type === 'LOW_STOCK'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                          : a.type === 'SHIFT_DISCREPANCY'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{a.title}</span>
                        </span>
                        <span className="text-[9px] opacity-60 font-normal">
                          {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed opacity-90">{a.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Lock Terminal */}
        <button
          onClick={handleLock}
          title="Lock Terminal (Ctrl+L)"
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-all"
        >
          <Lock className="w-5 h-5" />
        </button>

        {/* User Info Dropdown */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
            {user?.fullName.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="hidden sm:flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold text-white truncate max-w-[120px]">{user?.fullName}</span>
            <span className={`text-[10px] font-medium border rounded px-1.5 py-0.5 w-fit mt-0.5 ${getRoleBadgeColor(user?.role || '')}`}>
              {user?.role.replace('_', ' ')}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="ml-1 p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
