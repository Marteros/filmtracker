const RAIL_ITEMS = 6;
const SEARCH_ITEMS = 10;
const OVERVIEW_SECTIONS = ['Trending', 'Popular', 'Top rated'];

interface Props {
  variant?: 'overview' | 'search';
}

export function DiscoverPageSkeleton({ variant = 'overview' }: Props) {
  const searching = variant === 'search';

  return (
    <main
      className="app discover-page"
      role="status"
      aria-label={searching ? 'Searching movies' : 'Loading discover'}
      aria-live="polite"
    >
      <header className="discover-header">
        <div className="skeleton-block discover-skeleton-title" />
        {!searching && <div className="skeleton-block discover-skeleton-action" />}
      </header>
      {searching ? (
        <div className="discover-all-grid" aria-hidden="true">
          {Array.from({ length: SEARCH_ITEMS }, (_, index) => (
            <div className="discover-skeleton" key={index}>
              <span />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : (
        OVERVIEW_SECTIONS.map((section) => (
          <section key={section} className="discover-section" aria-hidden="true">
            <div className="discover-section-heading">
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
        ))
      )}
    </main>
  );
}
