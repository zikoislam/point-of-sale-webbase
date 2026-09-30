import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket-client';
import { api } from '../lib/api-client';

/** Persisted notification types the backend writes (Phase 9.5). */
export type NotificationType =
  | 'LOW_STOCK'
  | 'PO_APPROVAL'
  | 'NEW_SALE'
  | 'DUE_ALERT'
  | 'SYSTEM'
  // legacy live alerts kept for backwards compatibility
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
  entityType?: string;
  entityId?: string;
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

/**
 * Notification feed for the header bell.
 *
 * Sources:
 *  - GET /notifications            → persisted feed (survives reloads)
 *  - Socket.IO `NOTIFICATION`      → live push into the org room
 *  - legacy alert events           → older emitters (low stock / shift / …)
 *
 * Read state is written back to the server, so a badge cleared on one device
 * stays cleared everywhere.
 */
export const useRealTimeNotifications = () => {
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const loadedRef = useRef(false);

  const mapRow = (row: any): RealtimeAlert => ({
    id: String(row._id || row.id),
    type: (row.type || 'SYSTEM') as NotificationType,
    title: row.title || 'Notification',
    message: row.message || '',
    timestamp: new Date(row.createdAt || Date.now()),
    read: !!row.isRead,
    entityType: row.entityType,
    entityId: row.entityId,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=30');
      const rows = Array.isArray(res.data) ? res.data : [];
      setAlerts(rows.map(mapRow));
      setUnreadCount(rows.filter((r: any) => !r.isRead).length);
      loadedRef.current = true;
    } catch {
      // offline / not logged in yet — the socket will fill the list live
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pushAlert = useCallback((alert: Omit<RealtimeAlert, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: Date }) => {
    const newAlert: RealtimeAlert = {
      ...alert,
      id: alert.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: alert.timestamp || new Date(),
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev.slice(0, 29)]);
    setUnreadCount((prev) => prev + 1);
    playAlertChime();
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      // the next refresh reconciles
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
    try {
      await api.put('/notifications/mark-all-read');
    } catch {
      // the next refresh reconciles
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // Live persisted notification (Phase 9.5)
    const handleNotification = (row: any) => {
      if (!loadedRef.current) return; // initial fetch will include it
      pushAlert(mapRow(row));
    };

    // Legacy live events still emitted by some flows
    const handleLowStock = (data: any) =>
      pushAlert({
        type: 'LOW_STOCK_ALERT',
        title: 'Low Stock Alert',
        message: `Product "${data.productName || data.name || 'Item'}" reached low stock threshold (${data.currentStock} remaining).`,
        entityType: 'inventory',
        meta: data,
      });

    const handleShiftDiscrepancy = (data: any) =>
      pushAlert({
        type: 'SHIFT_DISCREPANCY_ALERT',
        title: 'Shift Discrepancy Escalation',
        message: `Shift closed by ${data.cashierName || 'Cashier'} with cash discrepancy of ৳${data.discrepancy || data.amount}.`,
        entityType: 'shifts',
        meta: data,
      });

    const handleOversell = (data: any) =>
      pushAlert({
        type: 'OFFLINE_OVERSELL_ALERT',
        title: 'Offline Oversell Warning',
        message: `Offline sale synced with negative inventory balance for SKU ${data.sku || data.barcode || 'N/A'}.`,
        entityType: 'inventory',
        meta: data,
      });

    const handleExpiry = (data: any) =>
      pushAlert({
        type: 'EXPIRY_WARNING',
        title: 'Batch Expiry Warning',
        message: `Batch for "${data.productName || 'Product'}" is expiring soon on ${data.expiryDate || 'N/A'}.`,
        entityType: 'inventory',
        meta: data,
      });

    socket.on('NOTIFICATION', handleNotification);
    socket.on('LOW_STOCK_ALERT', handleLowStock);
    socket.on('SHIFT_DISCREPANCY_ALERT', handleShiftDiscrepancy);
    socket.on('OFFLINE_OVERSELL_ALERT', handleOversell);
    socket.on('EXPIRY_WARNING', handleExpiry);

    return () => {
      socket.off('NOTIFICATION', handleNotification);
      socket.off('LOW_STOCK_ALERT', handleLowStock);
      socket.off('SHIFT_DISCREPANCY_ALERT', handleShiftDiscrepancy);
      socket.off('OFFLINE_OVERSELL_ALERT', handleOversell);
      socket.off('EXPIRY_WARNING', handleExpiry);
    };
  }, [pushAlert]);

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    addAlert: pushAlert,
    refresh,
  };
};
