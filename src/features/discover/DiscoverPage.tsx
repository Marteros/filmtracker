import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { findMovie } from '@/lib/movie';
import {
  getDiscoveryMovies,
  getRandomDiscoveryMovie,
  searchMovies,
  type DiscoveryCategory,
  type RandomMovieCriteria,
} from '@/services/tmdb';
import { DiscoverCard } from './DiscoverCard';
import { RandomizerDialog, type PeriodPreset } from './RandomizerDialog';
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

function periodToYears(preset: PeriodPreset): Pick<RandomMovieCriteria, 'fromYear' | 'toYear'> {
  if (preset === 'classic') return { toYear: 1979 };
  if (preset === '80s') return { fromYear: 1980, toYear: 1989 };
  if (preset === '90s') return { fromYear: 1990, toYear: 1999 };
  if (preset === '2000s') return { fromYear: 2000, toYear: 2009 };
  if (preset === '2010s') return { fromYear: 2010, toYear: 2019 };
  if (preset === 'recent') return { fromYear: 2020 };
  return {};
}

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
  const [randomDialogOpen, setRandomDialogOpen] = useState(false);
  const [randomGenre, setRandomGenre] = useState<number | 'all'>('all');
  const [randomRating, setRandomRating] = useState<number | 'all'>('all');
  const [randomPeriod, setRandomPeriod] = useState<PeriodPreset>('all');
  const [randomLanguage, setRandomLanguage] = useState<string>('all');
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState('');
  const [randomMovie, setRandomMovie] = useState<TmdbMovie | null>(null);
  const [recentRandomIds, setRecentRandomIds] = useState<number[]>([]);
  const randomDialogRef = useRef<HTMLDialogElement>(null);
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
  const randomOverlay = useHistoryOverlay<boolean>({
    key: 'frameRandomizer',
    onChange: (value) => setRandomDialogOpen(Boolean(value)),
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

  function openRandomDialog() {
    setRandomError('');
    if (randomDialogOpen) return;
    setRandomDialogOpen(true);
    randomOverlay.open(true);
  }

  function closeRandomDialog() {
    randomOverlay.close();
  }

  function handleOpenMovie(movie: TmdbMovie) {
    onOpen(movie);
  }

  async function pickRandomMovie() {
    setRandomLoading(true);
    setRandomError('');
    try {
      const criteria: RandomMovieCriteria = {
        ...periodToYears(randomPeriod),
        ...(randomGenre === 'all' ? {} : { genreId: randomGenre }),
        ...(randomRating === 'all' ? {} : { minRating: randomRating }),
        ...(randomLanguage === 'all' ? {} : { originalLanguage: randomLanguage }),
      };
      const avoidIds = new Set(recentRandomIds);
      let movie = await getRandomDiscoveryMovie(
        criteria,
        (candidate) =>
          Boolean(
            findMovie(collection, {
              tmdbId: candidate.id,
              title: candidate.title,
              year: candidate.release_date?.slice(0, 4),
            }),
          ),
        new AbortController().signal,
        avoidIds,
      );
      if (!movie && avoidIds.size) {
        movie = await getRandomDiscoveryMovie(
          criteria,
          (candidate) =>
            Boolean(
              findMovie(collection, {
                tmdbId: candidate.id,
                title: candidate.title,
                year: candidate.release_date?.slice(0, 4),
              }),
            ),
          new AbortController().signal,
          new Set(),
        );
      }
      setRandomMovie(movie);
      if (movie) {
        setRecentRandomIds((current) => [movie.id, ...current.filter((id) => id !== movie.id)].slice(0, 20));
      } else {
        setRandomError(
          'No movie found with these criteria that is not already in your collection. Try broader filters.',
        );
      }
    } catch (reason) {
      setRandomMovie(null);
      setRandomError(reason instanceof Error ? reason.message : 'Could not fetch a random movie.');
    } finally {
      setRandomLoading(false);
    }
  }

  return (
    <main className="app discover-page" hidden={hidden}>
      <header className={`discover-header${selectedSection ? ' has-section' : ''}`}>
        <h1>{selectedSection ? SECTIONS.find((section) => section.id === selectedSection)?.title : 'Discover'}</h1>
        <div className="discover-header-actions">
          {!selectedSection && !debouncedQuery && (
            <button className="discover-random-button" type="button" onClick={openRandomDialog}>
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
        dialogRef={randomDialogRef}
        open={randomDialogOpen}
        onClose={closeRandomDialog}
        genre={randomGenre}
        onGenreChange={setRandomGenre}
        rating={randomRating}
        onRatingChange={setRandomRating}
        period={randomPeriod}
        onPeriodChange={setRandomPeriod}
        language={randomLanguage}
        onLanguageChange={setRandomLanguage}
        loading={randomLoading}
        error={randomError}
        movie={randomMovie}
        collection={collection}
        onPick={pickRandomMovie}
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
