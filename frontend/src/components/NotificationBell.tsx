import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Package,
  AlertTriangle,
  WifiOff,
  Clock,
  CheckCheck,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { useRealTimeNotifications, RealtimeAlert } from '../hooks/useRealTimeNotifications';
import { cn, formatDateTime } from '../lib/utils';

export const NotificationBell: React.FC = () => {
  const { alerts, unreadCount, markAsRead, markAllAsRead, clearAlerts } = useRealTimeNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAlertConfig = (type: RealtimeAlert['type']) => {
    switch (type) {
      case 'LOW_STOCK_ALERT':
        return {
          icon: <Package className="w-4 h-4 text-rose-400" />,
          badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      case 'SHIFT_DISCREPANCY_ALERT':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'OFFLINE_OVERSELL_ALERT':
        return {
          icon: <WifiOff className="w-4 h-4 text-rose-400" />,
          badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      case 'EXPIRY_WARNING':
        return {
          icon: <Clock className="w-4 h-4 text-orange-400" />,
          badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        };
      default:
        return {
          icon: <Bell className="w-4 h-4 text-blue-400" />,
          badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
          isOpen && 'bg-slate-800 text-white'
        )}
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-scale-in">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-xs text-white">Live System Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {alerts.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark Read</span>
                </button>
                <button
                  type="button"
                  onClick={clearAlerts}
                  className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                  title="Clear all alerts"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-800/40">
            {alerts.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-slate-400">All clear!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No active system alerts or notifications.
                </p>
              </div>
            ) : (
              alerts.map((item) => {
                const config = getAlertConfig(item.type);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs transition-all relative group',
                      item.read ? 'bg-slate-900/60 border-slate-800/60 text-slate-400' : 'bg-slate-800/80 border-slate-700 text-slate-200 shadow-sm'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn('p-1.5 rounded-lg border shrink-0 mt-0.5', config.badgeClass)}>
                        {config.icon}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('font-semibold truncate text-xs', item.read ? 'text-slate-300' : 'text-white')}>
                            {item.title}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed break-words opacity-90">
                          {item.message}
                        </p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.id)}
                          className="text-slate-500 hover:text-emerald-400 p-1 rounded transition-colors shrink-0"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
