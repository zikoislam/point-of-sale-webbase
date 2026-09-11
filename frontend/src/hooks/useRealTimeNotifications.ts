import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket-client';

export type NotificationType =
  | 'LOW_STOCK_ALERT'
  | 'SHIFT_DISCREPANCY_ALERT'
  | 'OFFLINE_OVERSELL_ALERT'
  | 'EXPIRY_WARNING'
  | 'INFO';

export interface RealtimeAlert {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  meta?: any;
}

// Optional gentle audio chime using Web Audio API
function playAlertChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export const useRealTimeNotifications = () => {
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const addAlert = useCallback((alert: Omit<RealtimeAlert, 'id' | 'timestamp' | 'read'>) => {
    const newAlert: RealtimeAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev.slice(0, 29)]);
    setUnreadCount((prev) => prev + 1);
    playAlertChime();
  }, []);

  const markAsRead = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleLowStock = (data: any) => {
      addAlert({
        type: 'LOW_STOCK_ALERT',
        title: 'Low Stock Alert',
        message: `Product "${data.productName || data.name || 'Item'}" reached low stock threshold (${data.currentStock} remaining).`,
        meta: data,
      });
    };

    const handleShiftDiscrepancy = (data: any) => {
      addAlert({
        type: 'SHIFT_DISCREPANCY_ALERT',
        title: 'Shift Discrepancy Escalation',
        message: `Shift closed by ${data.cashierName || 'Cashier'} with cash discrepancy of ৳${data.discrepancy || data.amount}.`,
        meta: data,
      });
    };

    const handleOversell = (data: any) => {
      addAlert({
        type: 'OFFLINE_OVERSELL_ALERT',
        title: 'Offline Oversell Warning',
        message: `Offline sale synced with negative inventory balance for SKU ${data.sku || data.barcode || 'N/A'}.`,
        meta: data,
      });
    };

    const handleExpiry = (data: any) => {
      addAlert({
        type: 'EXPIRY_WARNING',
        title: 'Batch Expiry Warning',
        message: `Batch for "${data.productName || 'Product'}" is expiring soon on ${data.expiryDate || 'N/A'}.`,
        meta: data,
      });
    };

    socket.on('LOW_STOCK_ALERT', handleLowStock);
    socket.on('SHIFT_DISCREPANCY_ALERT', handleShiftDiscrepancy);
    socket.on('OFFLINE_OVERSELL_ALERT', handleOversell);
    socket.on('EXPIRY_WARNING', handleExpiry);

    return () => {
      socket.off('LOW_STOCK_ALERT', handleLowStock);
      socket.off('SHIFT_DISCREPANCY_ALERT', handleShiftDiscrepancy);
      socket.off('OFFLINE_OVERSELL_ALERT', handleOversell);
      socket.off('EXPIRY_WARNING', handleExpiry);
    };
  }, [addAlert]);

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    addAlert,
  };
};
