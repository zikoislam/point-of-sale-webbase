'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** The committed numeric value. */
  value: number;
  /** Called with the parsed number while typing; never called with NaN. */
  onValueChange: (value: number) => void;
  /** Set false for whole-number fields such as quantities. */
  allowDecimal?: boolean;
}

/**
 * A numeric field that can actually be cleared and retyped.
 *
 * Binding a number straight to an <input> makes an empty field read back as 0,
 * so clearing it leaves a "0" behind and the next keystroke produces "050000".
 * A local draft lets the field be empty mid-edit and drops leading zeros as they
 * are typed, while still reporting a clean number upwards.
 *
 * While the field is focused the parent's value is NOT written back into the
 * draft, otherwise the caret would jump on every keystroke. It is re-synced on
 * blur, and whenever the parent changes the value from the outside.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, allowDecimal = true, onBlur, onFocus, ...rest }, ref) => {
    const [draft, setDraft] = useState(String(value ?? 0));
    const editing = useRef(false);

    useEffect(() => {
      if (!editing.current) setDraft(String(value ?? 0));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(allowDecimal ? /[^0-9.-]/g : /[^0-9-]/g, '');

      // Let the field sit empty, or hold a lone "-" / trailing "." mid-typing.
      if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
        setDraft(raw);
        if (raw === '') onValueChange(0);
        return;
      }

      // 05 -> 5, 007 -> 7, but leave "0.5" alone.
      const trimmed = raw.replace(/^(-?)0+(?=\d)/, '$1');
      setDraft(trimmed);

      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) onValueChange(parsed);
    };

    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={draft}
        onChange={handleChange}
        onFocus={(e) => {
          editing.current = true;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          editing.current = false;
          // An abandoned empty field falls back to the last committed value.
          setDraft(String(value ?? 0));
          onBlur?.(e);
        }}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';
