'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../lib/i18n';
import { MODULE_DEFS } from '../../../lib/modules';

/**
 * All modules — the workspace picker.
 *
 * Choosing a module takes you into it, and the sidebar immediately narrows to
 * just that module's features plus its own reports (see lib/modules.ts). This
 * page is the "way back"; the sidebar links here from every module.
 */
export default function AllModulesPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const can = (permission?: string) => {
    if (!permission || !user) return true;
    if (user.role === 'SUPER_ADMIN' || user.isPlatformSuperAdmin) return true;
    return (user.permissions || []).includes(permission);
  };

  const modules = MODULE_DEFS.filter((mod) => can(mod.permission));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{t('modules.title')}</h1>
          <p className="text-xs text-slate-400">{t('modules.subtitle')}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          {t('modules.hint')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const reports = mod.reports.filter((r) => can(r.permission));
          return (
            <div
              key={mod.id}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-slate-600 transition-colors flex flex-col"
            >
              <Link href={mod.hub} className={`bg-gradient-to-r ${mod.accent} px-4 py-3 flex items-center gap-3`}>
                <mod.icon className="w-5 h-5 text-white shrink-0" />
                <h2 className="text-sm font-bold text-white truncate">{t(mod.labelKey)}</h2>
                <ArrowRight className="w-4 h-4 text-white/80 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <div className="p-4 flex-1 space-y-3">
                {mod.descKey && <p className="text-xs text-slate-400">{t(mod.descKey)}</p>}

                <Link
                  href={mod.hub}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  {t('modules.open')} <ArrowRight className="w-3 h-3" />
                </Link>

                {reports.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
                    {reports.slice(0, 6).map((report) => (
                      <Link
                        key={`${mod.id}-${report.labelKey}`}
                        href={report.href}
                        className="px-2 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                      >
                        {t(report.labelKey)}
                      </Link>
                    ))}
                    {reports.length > 6 && (
                      <span className="px-2 py-1 text-[10px] text-slate-500">+{reports.length - 6}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
