import { useEffect, useRef, useState } from 'react';
import { findMovie } from '@/lib/movie';
/* discover fetch logic lives in useDiscovery */
import { DiscoverCard } from './DiscoverCard';
import { RandomizerDialog } from './RandomizerDialog';
import { useRandomizer } from './useRandomizer';
import { DISCOVER_SECTIONS, useDiscovery } from './useDiscovery';
import type { Movie, TmdbMovie } from '@/types';

interface Props {
  collection: Movie[];
  query: string;
  onAdd(movie: TmdbMovie, status: 'seen' | 'watchlist'): boolean;
  onOpen(movie: TmdbMovie): void;
  hidden?: boolean;
}

export function DiscoverPage({ collection, query, onAdd, onOpen, hidden = false }: Props) {
  const [actionError, setActionError] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const randomizer = useRandomizer(collection);
  const {
    debouncedQuery,
    searchResults,
    feeds,
    selectedSection,
    loading,
    loadingMore,
    hasMore,
    error,
    retry,
    openSection,
    closeSection,
    loadMore,
  } = useDiscovery(query, !hidden);

  useEffect(() => {
    if (hidden || !selectedSection || !hasMore || loading || loadingMore || error) return;
    const node = loadMoreRef.current;
    if (!node) return;

    let ticking = false;
    const check = () => {
      ticking = false;
      if (loading || loadingMore || !hasMore) return;
      const rect = node.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 400) void loadMore();
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: '400px 0px', threshold: 0 },
    );
    observer.observe(node);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [hidden, selectedSection, hasMore, loading, loadingMore, error, loadMore]);

  function handleAdd(movie: TmdbMovie, status: 'seen' | 'watchlist') {
    setActionError('');
    if (!onAdd(movie, status)) setActionError('Could not save. Check the available storage on this device.');
  }

  function handleOpenMovie(movie: TmdbMovie) {
    onOpen(movie);
  }

  return (
    <main className="app discover-page" hidden={hidden}>
      <header className={`discover-header${selectedSection ? ' has-section' : ''}`}>
        <h1>
          {selectedSection ? DISCOVER_SECTIONS.find((section) => section.id === selectedSection)?.title : 'Discover'}
        </h1>
        <div className="discover-header-actions">
          {!selectedSection && !debouncedQuery && (
            <button className="discover-random-button" type="button" onClick={randomizer.openDialog}>
              Surprise me
            </button>
          )}
          {selectedSection && (
            <button className="discover-back" type="button" onClick={closeSection}>
              ← Back
            </button>
          )}
        </div>
      </header>

      <RandomizerDialog
        dialogRef={randomizer.dialogRef}
        open={randomizer.open}
        onClose={randomizer.closeDialog}
        genre={randomizer.genre}
        onGenreChange={randomizer.setGenre}
        rating={randomizer.rating}
        onRatingChange={randomizer.setRating}
        period={randomizer.period}
        onPeriodChange={randomizer.setPeriod}
        language={randomizer.language}
        onLanguageChange={randomizer.setLanguage}
        loading={randomizer.loading}
        error={randomizer.error}
        movie={randomizer.movie}
        collection={collection}
        onPick={randomizer.pick}
        onOpenMovie={handleOpenMovie}
        onAddMovie={handleAdd}
      />

      {actionError && (
        <p className="discover-inline-error" role="alert">
          {actionError}
        </p>
      )}
      {error && (
        <div className="discover-inline-error" role="alert">
          {error}{' '}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <div className="discover-grid" role="status" aria-label="Loading movies">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="discover-skeleton" key={index}>
              <span />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : debouncedQuery ? (
        searchResults.length ? (
          <section className="discover-all-grid" aria-label="Search results">
            {searchResults.map((movie) => (
              <DiscoverCard
                key={movie.id}
                movie={movie}
                saved={findMovie(collection, {
                  tmdbId: movie.id,
                  title: movie.title,
                  year: movie.release_date?.slice(0, 4),
                })}
                onOpen={handleOpenMovie}
                onAdd={handleAdd}
              />
            ))}
          </section>
        ) : (
          !error && (
            <div className="discover-message discover-empty">
              <h2>No movies found</h2>
              <p>Try a different title.</p>
            </div>
          )
        )
      ) : selectedSection ? (
        <>
          <section
            className="discover-all-grid"
            aria-label={`${DISCOVER_SECTIONS.find((section) => section.id === selectedSection)?.title} movies`}
          >
            {(feeds[selectedSection] || []).map((movie) => (
              <DiscoverCard
                key={movie.id}
                movie={movie}
                saved={findMovie(collection, {
                  tmdbId: movie.id,
                  title: movie.title,
                  year: movie.release_date?.slice(0, 4),
                })}
                onOpen={handleOpenMovie}
                onAdd={handleAdd}
              />
            ))}
          </section>
          {!error && hasMore && <div ref={loadMoreRef} className="discover-load-sentinel" aria-hidden="true" />}
          {loadingMore && (
            <p className="discover-loading-more" role="status" aria-live="polite">
              Loading more movies…
            </p>
          )}
        </>
      ) : (
        <div className="discover-sections">
          {DISCOVER_SECTIONS.map(({ id, title }) => (
            <section className="discover-section" key={id} aria-labelledby={`discover-${id}`}>
              <div className="discover-section-heading">
                <h2 id={`discover-${id}`}>{title}</h2>
                <button type="button" onClick={() => openSection(id)}>
                  View all <span aria-hidden="true">→</span>
                </button>
              </div>
              {feeds[id]?.length ? (
                <div className="discover-rail">
                  {feeds[id].slice(0, 12).map((movie) => (
                    <DiscoverCard
                      key={movie.id}
                      movie={movie}
                      saved={findMovie(collection, {
                        tmdbId: movie.id,
                        title: movie.title,
                        year: movie.release_date?.slice(0, 4),
                      })}
                      onOpen={handleOpenMovie}
                      onAdd={handleAdd}
                    />
                  ))}
                </div>
              ) : (
                <div className="discover-rail discover-rail-skeleton" aria-label={`Loading ${title}`} role="status">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div className="discover-skeleton" key={index}>
                      <span />
                      <i />
                      <i />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
