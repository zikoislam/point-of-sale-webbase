import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: any) => void;
  onClear?: () => void;
  debounceMs?: number;
  loading?: boolean;
  hotkeyHint?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value: controlledValue,
      onChange,
      onClear,
      debounceMs = 300,
      loading = false,
      hotkeyHint,
      placeholder = 'Search...',
      className,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState(controlledValue || '');
    const isFirstRender = useRef(true);

    useEffect(() => {
      if (controlledValue !== undefined) {
        setLocalValue(controlledValue);
      }
    }, [controlledValue]);

    useEffect(() => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }

      const timer = setTimeout(() => {
        if (onChange) {
          (onChange as any)(localValue);
          (onChange as any)({ target: { value: localValue } });
        }
      }, debounceMs);

      return () => clearTimeout(timer);
    }, [localValue, debounceMs, onChange]);

    const handleClear = () => {
      setLocalValue('');
      if (onChange) {
        (onChange as any)('');
        (onChange as any)({ target: { value: '' } });
      }
      onClear?.();
    };

    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          {loading ? <Spinner size="sm" color="primary" /> : <Search className="w-4 h-4" />}
        </div>

        <input
          ref={ref}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full h-10 pl-10 pr-12 bg-slate-900 text-sm text-slate-100 rounded-lg border border-slate-700',
            'placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all'
          )}
          {...props}
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {localValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {hotkeyHint && !localValue && (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded">
              {hotkeyHint}
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
