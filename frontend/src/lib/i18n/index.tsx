'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Locale, LOCALES, translations } from './dictionary';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a key; unknown keys fall back to English, then to the key. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Currency formatted for the active locale. */
  formatMoney: (value: number | null | undefined, symbol?: string) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | Date | null | undefined, withTime?: boolean) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'pos_locale';

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'bn';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'bn') return stored;
  // Default to Bangla — the shop floor works in Bangla; the switcher is in the header.
  return 'bn';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('bn');

  // Read the stored preference after mount so the server and client markup match
  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage may be unavailable (private mode) — the session still switches
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = translations[key];
      let text = entry ? entry[locale] || entry.en : key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }
      }
      return text;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => {
    const intlLocale = locale === 'bn' ? 'bn-BD' : 'en-US';

    return {
      locale,
      setLocale,
      t,
      formatMoney: (amount, symbol = '৳') => {
        const n = Number(amount ?? 0);
        // Bangla numerals read naturally for the shop staff, but the currency
        // symbol stays the familiar ৳ in both locales.
        return `${symbol}${n.toLocaleString(intlLocale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      },
      formatNumber: (amount) => Number(amount ?? 0).toLocaleString(intlLocale),
      formatDate: (input, withTime = false) => {
        if (!input) return '—';
        const d = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(d.getTime())) return '—';
        return withTime ? d.toLocaleString(intlLocale) : d.toLocaleDateString(intlLocale);
      },
    };
  }, [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return ctx;
}

/** Shorthand for components that only need the translate function. */
export function useTranslation() {
  const { t, locale, setLocale } = useI18n();
  return { t, locale, setLocale };
}

export { LOCALES, translations };
export type { Locale };
