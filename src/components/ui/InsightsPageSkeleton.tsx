export function InsightsPageSkeleton() {
  return (
    <main className="app insights-page" role="status" aria-label="Loading insights" aria-live="polite">
      <div className="mobile-collection-heading">
        <div className="skeleton-block insights-skeleton-heading" />
        <span className="skeleton-block insights-skeleton-count" />
      </div>
      <section className="insights-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <article className={`insight-card${index === 0 ? ' highlight' : ''}`} key={index}>
            <div className="skeleton-block insights-skeleton-label" />
            <div className="skeleton-block insights-skeleton-value" />
            <div className="skeleton-block insights-skeleton-sub" />
          </article>
        ))}
      </section>
      <section className="insight-section" aria-hidden="true">
        <div className="skeleton-block insights-skeleton-section-title" />
        <div className="insights-skeleton-bars">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="insights-skeleton-bar-row" key={index}>
              <span className="skeleton-block" />
              <span className="skeleton-block" />
              <span className="skeleton-block" />
            </div>
          ))}
        </div>
      </section>
      <section className="insight-section" aria-hidden="true">
        <div className="skeleton-block insights-skeleton-section-title" />
        <div className="insights-skeleton-chips">
          {Array.from({ length: 5 }, (_, index) => (
            <span className="skeleton-block insights-skeleton-chip" key={index} />
          ))}
        </div>
      </section>
    </main>
  );
}
