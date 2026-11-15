interface Props {
  value: string;
  onChange(value: string): void;
  label: string;
  placeholder?: string;
}

export function SearchField({ value, onChange, label, placeholder }: Props) {
  return (
    <label className="discover-search">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" /><path d="m13.2 13.2 4 4" /></svg>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && <button type="button" aria-label="Zoekopdracht wissen" onClick={() => onChange('')}>×</button>}
    </label>
  );
}
