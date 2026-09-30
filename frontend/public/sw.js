/* eslint-disable no-undef */
/**
 * BDBBC ERP service worker (Phase: PWA).
 *
 * What it does
 *  - keeps the application shell (POS, login, dashboard) available offline, so
 *    a till that loses the internet can still open the screen and queue sales;
 *  - serves hashed Next.js assets from cache first (they never change);
 *  - falls back to /offline for any navigation it cannot reach.
 *
 * What it deliberately does NOT do
 *  - it never caches API traffic: business data is per-user and changes
 *    constantly, and the app already has its own offline sale queue
 *    (/sales/offline-sync). Caching responses here would risk showing a
 *    manager yesterday's numbers as if they were today's.
 */

const VERSION = 'v1';
const SHELL_CACHE = `bdbbc-shell-${VERSION}`;
const ASSET_CACHE = `bdbbc-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

const SHELL_PRECACHE = ['/', '/pos', '/login', OFFLINE_URL, '/manifest.webmanifest', '/icon.svg', '/bdbbc-logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individual failures must not abort the whole install
      await Promise.all(
        SHELL_PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never touch writes

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave third parties alone
  if (isApiRequest(url)) return; // real-time data stays live-only

  // Page navigations: live first, cached copy second, offline page last
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, fresh.clone()).catch(() => undefined);
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Hashed build assets and media: cache first, refresh in the background
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          fetch(request)
            .then((fresh) => caches.open(ASSET_CACHE).then((c) => c.put(request, fresh)))
            .catch(() => undefined);
          return cached;
        }
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(ASSET_CACHE);
          cache.put(request, fresh.clone()).catch(() => undefined);
          return fresh;
        } catch {
          return new Response('', { status: 504 });
        }
      })()
    );
  }
});

// Lets the app trigger an immediate update after a deploy
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
