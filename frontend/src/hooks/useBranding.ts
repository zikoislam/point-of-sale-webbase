'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/constants';

export interface Branding {
  shopName: string;
  logoUrl: string;
  currencySymbol: string;
  shopAddress?: string;
  shopPhone?: string;
  /** Settings → Receipt header / footer text. */
  receiptHeader?: string;
  receiptFooter?: string;
}

const FALLBACK: Branding = { shopName: 'Smart Retail POS', logoUrl: '', currencySymbol: '৳' };

let cache: Branding | null = null;

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cache || FALLBACK);

  useEffect(() => {
    if (cache) {
      setBranding(cache);
      return;
    }
    let active = true;

    // Logged-in users get the ACTIVE organization's branding (org-scoped
    // endpoint); everyone else falls back to the public first-org branding.
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('pos_token') : null;
    const url = token ? `${API_BASE_URL}/settings/branding` : `${API_BASE_URL}/settings/public`;

    fetch(url, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j.data && active) {
          cache = j.data;
          setBranding(j.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return branding;
}

export function invalidateBranding(): void {
  cache = null;
}
