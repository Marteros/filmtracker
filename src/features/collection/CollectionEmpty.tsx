interface Props {
  onDiscover?(): void;
  onOpenSettings?(): void;
}

export function CollectionEmpty({ onDiscover, onOpenSettings }: Props) {
  const compassIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" />
    </svg>
  );
  const bookmarkIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
    </svg>
  );
  const eyeIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const searchIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
  const settingsIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <div className="empty-state onboarding-empty">
      <h3>No movies added yet</h3>
      <p className="onboarding-intro">Here’s how you can fill your collection:</p>
      <ul className="onboarding-options">
        <li>
          <span className="onboarding-icon">{compassIcon}</span>
          <div className="onboarding-copy">
            <strong>Via Discover</strong>
            <p>
              Search or browse movies and add them directly from a poster:{' '}
              <span className="inline-icon">{bookmarkIcon}</span> for your watchlist or{' '}
              <span className="inline-icon">{eyeIcon}</span> as seen.
            </p>
          </div>
        </li>
        <li>
          <span className="onboarding-icon">{searchIcon}</span>
          <div className="onboarding-copy">
            <strong>Search for a movie</strong>
            <p>
              Use Search in the top bar to find a movie, then add it to your watchlist or mark it as seen.
            </p>
          </div>
        </li>
        <li>
          <span className="onboarding-icon">{settingsIcon}</span>
          <div className="onboarding-copy">
            <strong>Sync with Trakt</strong>
            <p>
              Open <span className="inline-icon">{settingsIcon}</span> Settings to connect your Trakt account and import
              your watch history and watchlist.
            </p>
          </div>
        </li>
      </ul>
      <div className="onboarding-actions">
        {onDiscover && (
          <button className="onboarding-secondary" type="button" onClick={onDiscover}>
            Go to Discover
          </button>
        )}
        {onOpenSettings && (
          <button className="onboarding-secondary" type="button" onClick={onOpenSettings}>
            Settings
          </button>
        )}
      </div>
    </div>
  );
}
