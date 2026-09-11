import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket-client';

export interface RealtimeAlert {
  id: string;
  type: 'LOW_STOCK' | 'SHIFT_DISCREPANCY' | 'OFFLINE_OVERSELL' | 'INFO';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  meta?: any;
}

export const useRealTimeNotifications = () => {
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const addAlert = useCallback((alert: Omit<RealtimeAlert, 'id' | 'timestamp' | 'read'>) => {
    const newAlert: RealtimeAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev.slice(0, 29)]);
    setUnreadCount((prev) => prev + 1);
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
        type: 'LOW_STOCK',
        title: 'Low Stock Alert',
        message: `Product "${data.productName || data.name}" stock is at ${data.currentStock} (Alert threshold: ${data.alertQty})`,
        meta: data,
      });
    };

    const handleShiftDiscrepancy = (data: any) => {
      addAlert({
        type: 'SHIFT_DISCREPANCY',
        title: 'Shift Discrepancy Escalation',
        message: `Shift #${data.terminalId || data.shiftId} closed with cash discrepancy of ৳${data.discrepancy}`,
        meta: data,
      });
    };

    const handleOversell = (data: any) => {
      addAlert({
        type: 'OFFLINE_OVERSELL',
        title: 'Offline Oversell Warning',
        message: `Invoice #${data.invoiceNo} synced with negative inventory balance for SKU ${data.sku}`,
        meta: data,
      });
    };

    socket.on('LOW_STOCK_ALERT', handleLowStock);
    socket.on('SHIFT_DISCREPANCY_ALERT', handleShiftDiscrepancy);
    socket.on('OFFLINE_OVERSELL_ALERT', handleOversell);

    return () => {
      socket.off('LOW_STOCK_ALERT', handleLowStock);
      socket.off('SHIFT_DISCREPANCY_ALERT', handleShiftDiscrepancy);
      socket.off('OFFLINE_OVERSELL_ALERT', handleOversell);
    };
  }, [addAlert]);

  return {
    alerts,
    unreadCount,
    markAllAsRead,
    clearAlerts,
    addAlert,
  };
};
