'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { LOCALES, useI18n } from '../lib/i18n';
import { cn } from '../lib/utils';

interface LanguageSwitcherProps {
  /** `compact` shows only the two-letter codes (used in the header). */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * English ⇄ বাংলা switch. The choice is remembered per browser, so a till
 * stays in the language its operator picked.
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'compact', className }) => {
  const { locale, setLocale, t } = useI18n();

  if (variant === 'full') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Languages className="w-4 h-4 text-slate-400" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'en' | 'bn')}
          className="px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
          aria-label={t('header.language')}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className={cn('inline-flex items-center rounded-lg border border-slate-700 bg-slate-800/60 p-0.5', className)}
      title={t('header.language')}
    >
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={locale === l.code}
          className={cn(
            'px-2 py-1 text-[11px] font-semibold rounded-md transition-colors',
            locale === l.code ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
};
