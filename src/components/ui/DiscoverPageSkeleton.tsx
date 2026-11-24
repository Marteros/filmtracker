const RAIL_ITEMS = 6;

export function DiscoverPageSkeleton() {
  return (
    <main className="app discover-page" role="status" aria-label="Loading discover" aria-live="polite">
      <header className="discover-header">
        <div className="skeleton-block discover-skeleton-title" />
        <div className="skeleton-block discover-skeleton-action" />
      </header>
      <div className="toolbar discover-toolbar">
        <div className="skeleton-block discover-skeleton-search" />
      </div>
      {['Trending', 'Popular', 'Top rated'].map((section) => (
        <section key={section} className="discover-section" aria-hidden="true">
          <div className="discover-section-head">
            <div className="skeleton-block discover-skeleton-section-title" />
            <div className="skeleton-block discover-skeleton-link" />
          </div>
          <div className="discover-rail discover-rail-skeleton">
            {Array.from({ length: RAIL_ITEMS }, (_, index) => (
              <div className="discover-skeleton" key={index}>
                <span />
                <i />
                <i />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
