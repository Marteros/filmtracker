interface Props {
  view: 'grid' | 'list';
  onChange(view: 'grid' | 'list'): void;
  className?: string;
}

export function ViewToggle({ view, onChange, className = '' }: Props) {
  return (
    <div className={`view-toggle ${className}`.trim()} role="group" aria-label="View">
      <button
        type="button"
        className={view === 'grid' ? 'active' : ''}
        aria-pressed={view === 'grid'}
        aria-label="Grid view"
        title="Grid view"
        onClick={() => onChange('grid')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      </button>
      <button
        type="button"
        className={view === 'list' ? 'active' : ''}
        aria-pressed={view === 'list'}
        aria-label="List view"
        title="List view"
        onClick={() => onChange('list')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        </svg>
      </button>
    </div>
  );
}
