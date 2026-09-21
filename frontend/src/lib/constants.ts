// Relative by default: requests go to /api/v1 on this origin and next.config.mjs
// proxies them to the API. That keeps the auth cookie first-party and lets the
// desktop app run the backend on whichever port is free. Deployments that put the
// API on its own domain can still point NEXT_PUBLIC_API_URL at it directly.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
export const CURRENCY_SYMBOL = '৳';
export const DEFAULT_TAX_RATE = 5;
export const ITEMS_PER_PAGE = 20;
export const TOAST_DURATION = 4000;
export const DEBOUNCE_DELAY = 300;

/** Shown on the login page and in the sidebar footer. */
export const SOFTWARE_CREDIT = {
  company: 'Bdbbc.com',
  developer: 'Zakirul Islam',
  phone: '+8801534000350',
};
