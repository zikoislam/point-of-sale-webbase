import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  className?: string;
}

const formatDateToInput = (d: Date): string => {
  return d.toISOString().split('T')[0];
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('This Month');

  const today = new Date();
  const defaultRange: DateRange = {
    startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  };

  const currentRange = value || defaultRange;

  const applyPreset = (presetName: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (presetName) {
      case 'Today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'Last 7 Days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Last 30 Days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'This Month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Last Month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        break;
    }

    setActivePreset(presetName);
    onChange?.({
      startDate: formatDateToInput(start),
      endDate: formatDateToInput(end),
    });
    setIsOpen(false);
  };

  const handleCustomChange = (field: 'startDate' | 'endDate', val: string) => {
    setActivePreset('Custom');
    onChange?.({
      ...currentRange,
      [field]: val,
    });
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-3.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg text-sm text-slate-200 flex items-center gap-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <CalendarIcon className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-xs font-medium">
          {currentRange.startDate} <span className="text-slate-500">to</span> {currentRange.endDate}
        </span>
        <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/60 hidden sm:inline-block">
          {activePreset}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 sm:right-0 sm:left-auto mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-72 animate-scale-in">
          <div className="mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'Today',
                'Yesterday',
                'Last 7 Days',
                'Last 30 Days',
                'This Month',
                'Last Month',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors',
                    activePreset === preset
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Custom Range
            </span>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={currentRange.startDate}
                  onChange={(e) => handleCustomChange('startDate', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">End Date</label>
                <input
                  type="date"
                  value={currentRange.endDate}
                  onChange={(e) => handleCustomChange('endDate', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
