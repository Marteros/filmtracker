interface Props {
  label?: string;
}

export function PageSkeleton({ label = 'Loading' }: Props) {
  return (
    <div className="page-skeleton" role="status" aria-label={label} aria-live="polite">
      <div className="page-skeleton-head">
        <span className="page-skeleton-title" />
        <span className="page-skeleton-action" />
      </div>
      <div className="page-skeleton-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="page-skeleton-card" key={index}>
            <span />
            <i />
            <i />
          </div>
        ))}
      </div>
    </div>
  );
}
