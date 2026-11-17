import { useLayoutEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange(value: string): void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchField({ value, onChange, label, placeholder, autoFocus = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <label className="discover-search">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" /><path d="m13.2 13.2 4 4" /></svg>
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')}>×</button>}
    </label>
  );
}
