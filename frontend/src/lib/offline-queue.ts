/**
 * Offline Sale Queue using IndexedDB
 * Buffers sales transactions locally when internet goes down, and auto-syncs when online
 */

export interface QueuedSale {
  id: string;
  createdAt: number;
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  error?: string;
  retryCount: number;
}

const DB_NAME = 'POS_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_sales';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB not available in SSR'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue a sale to IndexedDB when offline
 */
export async function queueOfflineSale(payload: any): Promise<QueuedSale> {
  const db = await openDB();
  const queuedSale: QueuedSale = {
    id: payload.idempotencyKey || `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    payload: { ...payload, isOfflineSynced: true },
    status: 'PENDING',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(queuedSale);

    req.onsuccess = () => resolve(queuedSale);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all pending offline sales
 */
export async function getPendingOfflineSales(): Promise<QueuedSale[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Remove a synced sale from IndexedDB
 */
export async function removeOfflineSale(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Synchronize all pending offline sales to the server
 */
export async function syncOfflineQueue(
  apiBaseUrl: string,
  authHeaderFn: () => Record<string, string>
): Promise<{ successCount: number; failCount: number; errors: any[] }> {
  const pending = await getPendingOfflineSales();
  if (pending.length === 0) {
    return { successCount: 0, failCount: 0, errors: [] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: any[] = [];

  for (const item of pending) {
    try {
      const res = await fetch(`${apiBaseUrl}/sales/checkout`, {
        method: 'POST',
        headers: authHeaderFn(),
        body: JSON.stringify(item.payload),
      });

      const json = await res.json();
      if (json.success || json.statusCode === 409) {
        // Successfully processed or already idempotently processed
        await removeOfflineSale(item.id);
        successCount++;
      } else {
        failCount++;
        errors.push({ id: item.id, message: json.message });
      }
    } catch (err: any) {
      failCount++;
      errors.push({ id: item.id, message: err.message });
    }
  }

  return { successCount, failCount, errors };
}
