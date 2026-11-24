import type { ReactNode } from 'react';
import { SearchField } from '@/components/ui/SearchField';
import type { AppTab } from './useAppNavigation';

interface Props {
  activeTab: AppTab;
  onSwitchTab(tab: AppTab): void;
  onOpenSettings(): void;
  onOpenAgenda(): void;
  onAdd(): void;
  mobileSearchOpen: boolean;
  onMobileSearchOpen(): void;
  onMobileSearchClose(): void;
  searchValue: string;
  onSearchChange(value: string): void;
  onSearchFocus?(): void;
  showMobileFilter: boolean;
  mobileFilterActive: boolean;
  mobileFiltersOpen: boolean;
  onMobileFilterToggle(): void;
  storageError: string;
  traktNotice: string;
  shareNotice: string;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onSwitchTab,
  onOpenSettings,
  onOpenAgenda,
  onAdd,
  mobileSearchOpen,
  onMobileSearchOpen,
  onMobileSearchClose,
  searchValue,
  onSearchChange,
  onSearchFocus,
  showMobileFilter,
  mobileFilterActive,
  mobileFiltersOpen,
  onMobileFilterToggle,
  storageError,
  traktNotice,
  shareNotice,
  children,
}: Props) {
  return (
    <>
      <header className="desktop-appbar">
        <a className="desktop-brand" href="./" aria-label="Frame">
          frame<span>.</span>
        </a>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          onFocus={onSearchFocus}
          label="Search movies"
          placeholder="Search by movie title…"
        />
        <button
          className="desktop-settings"
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </header>
      <header className="mobile-appbar">
        {mobileSearchOpen ? (
          <div
            className="mobile-search-inline"
            id="mobile-search"
            role="search"
            aria-label="Search"
            onKeyDown={(event) => {
              if (event.key === 'Escape') onMobileSearchClose();
            }}
          >
            <SearchField
              value={searchValue}
              onChange={onSearchChange}
              onFocus={onSearchFocus}
              label="Search movies"
              placeholder="Search by movie title…"
              autoFocus
            />
            <button
              className="mobile-search-close"
              type="button"
              aria-label="Close search"
              title="Close search"
              onClick={onMobileSearchClose}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <a className="mobile-brand" href="./" aria-label="Frame — movie collection">
              frame<span aria-hidden="true">.</span>
            </a>
            <div className="mobile-appbar-actions">
              <button
                className="mobile-search-toggle"
                type="button"
                aria-label="Search"
                aria-expanded={false}
                aria-controls="mobile-search"
                title="Search"
                onClick={onMobileSearchOpen}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </button>
              {showMobileFilter && (
                <button
                  className={`mobile-filter-button${mobileFilterActive ? ' has-active' : ''}`}
                  type="button"
                  aria-label="Filters"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="mobile-filters"
                  title="Filters"
                  onClick={onMobileFilterToggle}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
                  </svg>
                </button>
              )}
              <button
                className="mobile-settings"
                type="button"
                aria-label="Settings"
                title="Settings"
                onClick={onOpenSettings}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </>
        )}
      </header>

      {storageError && (
        <p className="storage-error" role="alert">
          {storageError}
        </p>
      )}
      {traktNotice && (
        <p className="trakt-message" role="status">
          {traktNotice}
        </p>
      )}
      {shareNotice && (
        <p className="trakt-message" role="status">
          {shareNotice}
        </p>
      )}

      {children}

      <div className="mobile-bottom-actions">
        <div className="bottom-bar-side left">
          <button
            className="mobile-add-button agenda-button"
            type="button"
            aria-label="Agenda"
            title="Agenda"
            onClick={onOpenAgenda}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
          </button>
        </div>
        <nav className="mobile-bottom-tabs" aria-label="Main navigation">
          <button
            type="button"
            className={activeTab === 'history' ? 'active' : ''}
            aria-label="Seen"
            aria-current={activeTab === 'history' ? 'page' : undefined}
            onClick={() => onSwitchTab('history')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
            <span className="tab-label">Seen</span>
          </button>
          <button
            type="button"
            className={activeTab === 'watchlist' ? 'active' : ''}
            aria-label="Watchlist"
            aria-current={activeTab === 'watchlist' ? 'page' : undefined}
            onClick={() => onSwitchTab('watchlist')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
            </svg>
            <span className="tab-label">Watchlist</span>
          </button>
          <button
            type="button"
            className={activeTab === 'discover' ? 'active' : ''}
            aria-label="Discover"
            aria-current={activeTab === 'discover' ? 'page' : undefined}
            onClick={() => onSwitchTab('discover')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" />
            </svg>
            <span className="tab-label">Discover</span>
          </button>
          <button
            type="button"
            className={activeTab === 'insights' ? 'active' : ''}
            aria-label="Insights"
            aria-current={activeTab === 'insights' ? 'page' : undefined}
            onClick={() => onSwitchTab('insights')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19h16" />
              <rect x="6" y="11" width="3" height="6" rx="1" />
              <rect x="11" y="8" width="3" height="9" rx="1" />
              <rect x="16" y="5" width="3" height="12" rx="1" />
            </svg>
            <span className="tab-label">Insights</span>
          </button>
        </nav>
        <div className="bottom-bar-side right">
          <button className="mobile-add-button" type="button" aria-label="Add movie" title="Add movie" onClick={onAdd}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
      <footer className="tmdb-credit">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>
    </>
  );
}
