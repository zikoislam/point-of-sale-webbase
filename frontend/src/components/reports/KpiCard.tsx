'use client';

import React from 'react';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  tone?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'white' | 'purple';
  hint?: string;
}

const TONES: Record<string, string> = {
  emerald: 'text-emerald-400',
  indigo: 'text-indigo-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  purple: 'text-purple-400',
  white: 'text-white',
};

export function KpiCard({ label, value, tone = 'white', hint }: KpiCardProps) {
  return (
    <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl min-w-0">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg sm:text-2xl font-black mt-1 break-words ${TONES[tone]}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
