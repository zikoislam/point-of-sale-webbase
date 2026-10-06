'use client';

import React from 'react';
import { PERMISSION_GROUPS } from '../../lib/permissions';

/**
 * Grouped permission picker, shared by the Organizations console (envelope) and
 * the Plans console (a plan's permission set).
 */
export const PermissionChecklist: React.FC<{
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}> = ({ selected, onChange, disabled }) => (
  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
    {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
      <div key={group}>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{group}</h4>
          <button
            type="button"
            disabled={disabled}
            className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-40"
            onClick={() => {
              const allOn = perms.every((p) => selected.includes(p));
              onChange(
                allOn
                  ? selected.filter((p) => !perms.includes(p))
                  : [...selected, ...perms.filter((p) => !selected.includes(p))]
              );
            }}
          >
            {perms.every((p) => selected.includes(p)) ? 'none' : 'all'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {perms.map((perm) => {
            const on = selected.includes(perm);
            return (
              <label
                key={perm}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                  on
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  className="accent-emerald-500 w-3 h-3"
                  checked={on}
                  disabled={disabled}
                  onChange={() =>
                    onChange(on ? selected.filter((p) => p !== perm) : [...selected, perm])
                  }
                />
                {perm}
              </label>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);
