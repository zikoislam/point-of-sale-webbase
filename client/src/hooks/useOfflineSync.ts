import { useState, useEffect, useCallback } from 'react';
import { syncOfflineQueue, getPendingOfflineSales, QueuedSale } from '../lib/offline-queue';

export const useOfflineSync = (
  apiBaseUrl: string,
  authHeaderFn: () => Record<string, string>
) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number;
    failed: number;
    timestamp: Date;
  } | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending: QueuedSale[] = await getPendingOfflineSales();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncOfflineQueue(apiBaseUrl, authHeaderFn);
      await refreshPendingCount();
      setLastSyncResult({
        synced: result.successCount,
        failed: result.failCount,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Offline sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [apiBaseUrl, authHeaderFn, isSyncing, refreshPendingCount]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check / sync attempt every 30 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        refreshPendingCount();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, triggerSync]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
    refreshPendingCount,
  };
};
