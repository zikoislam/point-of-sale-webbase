'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/constants';

export interface Branding {
  shopName: string;
  logoUrl: string;
  currencySymbol: string;
  shopAddress?: string;
  shopPhone?: string;
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
    fetch(`${API_BASE_URL}/settings/public`, { credentials: 'include' })
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
