import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { findMovie } from '@/lib/movie';
import { getDiscoveryMovies, searchMovies, type DiscoveryCategory } from '@/services/tmdb';
import { DiscoverCard } from './DiscoverCard';
import { RandomizerDialog } from './RandomizerDialog';
import { useRandomizer } from './useRandomizer';
import { SearchField } from '@/components/ui/SearchField';
import type { Movie, TmdbMovie } from '@/types';

interface Props {
  collection: Movie[];
  query: string;
  onQueryChange(value: string): void;
  onAdd(movie: TmdbMovie, status: 'seen' | 'watchlist'): boolean;
  onOpen(movie: TmdbMovie): void;
  hidden?: boolean;
}

const SECTIONS: Array<{ id: DiscoveryCategory; title: string }> = [
  { id: 'trending', title: 'Trending' },
  { id: 'popular', title: 'Popular' },
  { id: 'top_rated', title: 'Top rated' },
];

export function DiscoverPage({ collection, query, onQueryChange, onAdd, onOpen, hidden = false }: Props) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TmdbMovie[]>([]);
  const [feeds, setFeeds] = useState<Partial<Record<DiscoveryCategory, TmdbMovie[]>>>({});
  const [selectedSection, setSelectedSection] = useState<DiscoveryCategory>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [retry, setRetry] = useState(0);
  const randomizer = useRandomizer(collection);
  const overviewScrollRef = useRef(0);
  const restoreOverviewScrollRef = useRef<number | null>(null);

  const sectionOverlay = useHistoryOverlay<DiscoveryCategory>({
    key: 'frameSection',
    onChange: (section) => {
      if (section) {
        if (!selectedSection) overviewScrollRef.current = window.scrollY;
        setSelectedSection(section);
        setError('');
      } else {
        restoreOverviewScrollRef.current = overviewScrollRef.current;
        setSelectedSection(undefined);
        setError('');
      }
    },
  });

  useLayoutEffect(() => {
    if (selectedSection) {
      window.scrollTo(0, 0);
      return;
    }
    if (restoreOverviewScrollRef.current !== null) {
      const top = restoreOverviewScrollRef.current;
      restoreOverviewScrollRef.current = null;
      window.scrollTo(0, top);
    }
  }, [selectedSection]);

  function openSection(section: DiscoveryCategory) {
    overviewScrollRef.current = window.scrollY;
    setSelectedSection(section);
    setError('');
    sectionOverlay.open(section);
  }

  function closeSection() {
    sectionOverlay.close();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (debouncedQuery) {
      searchMovies(debouncedQuery, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setSearchResults(results);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else if (selectedSection) {
      setPage(1);
      setHasMore(true);
      getDiscoveryMovies(selectedSection, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return;
          setFeeds((current) => ({ ...current, [selectedSection]: results }));
          setHasMore(results.length >= 20);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else {
      Promise.all(SECTIONS.map(async ({ id }) => [id, await getDiscoveryMovies(id, controller.signal)] as const))
        .then((results) => {
          if (!controller.signal.aborted)
            setFeeds(Object.fromEntries(results) as Record<DiscoveryCategory, TmdbMovie[]>);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    return () => controller.abort();
  }, [debouncedQuery, retry, selectedSection]);

  async function loadMore() {
    if (!selectedSection || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const results = await getDiscoveryMovies(selectedSection, new AbortController().signal, undefined, nextPage);
      setFeeds((current) => {
        const existing = current[selectedSection] || [];
        const seen = new Set(existing.map((m) => m.id));
        const appended = results.filter((m) => !seen.has(m.id));
        return { ...current, [selectedSection]: [...existing, ...appended] };
      });
      setPage(nextPage);
      setHasMore(results.length >= 20);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load more movies.');
    } finally {
      setLoadingMore(false);
    }
  }

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
        <h1>{selectedSection ? SECTIONS.find((section) => section.id === selectedSection)?.title : 'Discover'}</h1>
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

      <div className="toolbar discover-toolbar">
        <SearchField
          value={query}
          onChange={onQueryChange}
          label="Search movies to discover"
          placeholder="Search by movie title…"
        />
      </div>
      {actionError && (
        <p className="discover-inline-error" role="alert">
          {actionError}
        </p>
      )}
      {error && (
        <div className="discover-inline-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
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
            aria-label={`${SECTIONS.find((section) => section.id === selectedSection)?.title} movies`}
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
          {!error && hasMore && (
            <button className="discover-load-more" type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more movies'}
            </button>
          )}
        </>
      ) : (
        <div className="discover-sections">
          {SECTIONS.map(({ id, title }) => (
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
