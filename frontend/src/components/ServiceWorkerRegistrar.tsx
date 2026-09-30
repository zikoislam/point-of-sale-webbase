'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that makes the app installable and keeps the
 * POS shell working when the connection drops.
 *
 * Registration is skipped in development so a stale cache never hides a
 * change you just made.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('Service worker registration failed:', err));
    };

    // Register after the page is interactive so it never delays first paint
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
