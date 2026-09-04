import React, { useState, useEffect } from 'react';
import { formatDateDDMMYYYY, parseInputDate } from '../utils/dateFormat';

function formatWhileTyping(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * DD/MM/YYYY text input — stores ISO YYYY-MM-DD via onChange(iso).
 * Replaces native <input type="date"> which shows mm/dd/yyyy on Windows Electron.
 */
export default function DateInput({ value = '', onChange, className = '', ...rest }) {
  const [display, setDisplay] = useState(() => formatDateDDMMYYYY(value));

  useEffect(() => {
    setDisplay(formatDateDDMMYYYY(value));
  }, [value]);

  const handleChange = (e) => {
    const formatted = formatWhileTyping(e.target.value);
    setDisplay(formatted);
    if (!formatted) {
      onChange?.('');
      return;
    }
    if (formatted.length === 10) {
      const iso = parseInputDate(formatted);
      if (iso) onChange?.(iso);
    }
  };

  const handleBlur = () => {
    if (!display.trim()) {
      onChange?.('');
      setDisplay('');
      return;
    }
    const iso = parseInputDate(display);
    if (iso) {
      onChange?.(iso);
      setDisplay(formatDateDDMMYYYY(iso));
    } else {
      setDisplay(formatDateDDMMYYYY(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      autoComplete="off"
      spellCheck={false}
      maxLength={10}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...rest}
    />
  );
}
