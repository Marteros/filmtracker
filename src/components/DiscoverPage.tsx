import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getDiscoveryMovies, getRandomDiscoveryMovie, searchMovies, tmdbPoster, type DiscoveryCategory, type RandomMovieCriteria } from '../services/tmdb';
import { SearchField } from './SearchField';
import { MOVIE_GENRES } from '../constants/genres';
import { LANGUAGE_OPTIONS } from '../constants/languages';
import type { Movie, TmdbMovie } from '../types';

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

type PeriodPreset = 'all' | 'classic' | '80s' | '90s' | '2000s' | '2010s' | 'recent';

function periodToYears(preset: PeriodPreset): Pick<RandomMovieCriteria, 'fromYear' | 'toYear'> {
  if (preset === 'classic') return { toYear: 1979 };
  if (preset === '80s') return { fromYear: 1980, toYear: 1989 };
  if (preset === '90s') return { fromYear: 1990, toYear: 1999 };
  if (preset === '2000s') return { fromYear: 2000, toYear: 2009 };
  if (preset === '2010s') return { fromYear: 2010, toYear: 2019 };
  if (preset === 'recent') return { fromYear: 2020 };
  return {};
}

function matchingMovie(movie: TmdbMovie, collection: Movie[]) {
  const year = movie.release_date?.slice(0, 4);
  return collection.find((saved) => saved.tmdbId === movie.id
    || (saved.title.toLocaleLowerCase() === movie.title.toLocaleLowerCase() && saved.year === year));
}

export function DiscoverPage({ collection, query, onQueryChange, onAdd, onOpen, hidden = false }: Props) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TmdbMovie[]>([]);
  const [feeds, setFeeds] = useState<Partial<Record<DiscoveryCategory, TmdbMovie[]>>>({});
  const [selectedSection, setSelectedSection] = useState<DiscoveryCategory>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [retry, setRetry] = useState(0);
  const randomDialogRef = useRef<HTMLDialogElement>(null);
  const [randomDialogOpen, setRandomDialogOpen] = useState(false);
  const [randomGenre, setRandomGenre] = useState<number | 'all'>('all');
  const [randomRating, setRandomRating] = useState<number | 'all'>('all');
  const [randomPeriod, setRandomPeriod] = useState<PeriodPreset>('all');
  const [randomLanguage, setRandomLanguage] = useState<string>('all');
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState('');
  const [randomMovie, setRandomMovie] = useState<TmdbMovie | null>(null);
  const [recentRandomIds, setRecentRandomIds] = useState<number[]>([]);
  const overviewScrollRef = useRef(0);
  const restoreOverviewScrollRef = useRef<number | null>(null);
  const sectionHistoryRef = useRef(false);

  useEffect(() => {
    const dialog = randomDialogRef.current;
    if (!dialog) return;
    if (randomDialogOpen && !dialog.open) dialog.showModal();
    if (!randomDialogOpen && dialog.open) dialog.close();
  }, [randomDialogOpen]);

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
    if (!sectionHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameSection: true }, '');
      sectionHistoryRef.current = true;
    }
  }

  function closeSection() {
    if (sectionHistoryRef.current) {
      window.history.back();
      return;
    }
    restoreOverviewScrollRef.current = overviewScrollRef.current;
    setSelectedSection(undefined);
    setError('');
  }

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      if (!sectionHistoryRef.current) return;
      if (event.state?.frameSection) return;
      sectionHistoryRef.current = false;
      restoreOverviewScrollRef.current = overviewScrollRef.current;
      setSelectedSection(undefined);
      setError('');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
        .then((results) => { if (!controller.signal.aborted) setSearchResults(results); })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else if (selectedSection) {
      setPage(1);
      getDiscoveryMovies(selectedSection, controller.signal)
        .then((results) => { if (!controller.signal.aborted) setFeeds((current) => ({ ...current, [selectedSection]: results })); })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      Promise.all(SECTIONS.map(async ({ id }) => [id, await getDiscoveryMovies(id, controller.signal)] as const))
        .then((results) => {
          if (!controller.signal.aborted) setFeeds(Object.fromEntries(results) as Record<DiscoveryCategory, TmdbMovie[]>);
        })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [debouncedQuery, retry, selectedSection]);

  async function loadMore() {
    if (!selectedSection || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const results = await getDiscoveryMovies(selectedSection, new AbortController().signal, undefined, nextPage);
      setFeeds((current) => ({ ...current, [selectedSection]: [...(current[selectedSection] || []), ...results] }));
      setPage(nextPage);
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
    setRandomDialogOpen(true);
  }

  function closeRandomDialog() {
    setRandomDialogOpen(false);
  }

  function handleOpenMovie(movie: TmdbMovie) {
    closeRandomDialog();
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
        (candidate) => Boolean(matchingMovie(candidate, collection)),
        new AbortController().signal,
        avoidIds,
      );
      if (!movie && avoidIds.size) {
        movie = await getRandomDiscoveryMovie(
          criteria,
          (candidate) => Boolean(matchingMovie(candidate, collection)),
          new AbortController().signal,
          new Set(),
        );
      }
      setRandomMovie(movie);
      if (movie) {
        setRecentRandomIds((current) => [movie.id, ...current.filter((id) => id !== movie.id)].slice(0, 20));
      } else {
        setRandomError('No movie found with these criteria that is not already in your collection. Try broader filters.');
      }
    } catch (reason) {
      setRandomMovie(null);
      setRandomError(reason instanceof Error ? reason.message : 'Could not fetch a random movie.');
    } finally {
      setRandomLoading(false);
    }
  }

  function renderCard(movie: TmdbMovie) {
    const saved = matchingMovie(movie, collection);
    const poster = tmdbPoster(movie.poster_path, 'w342');
    const vote = movie.vote_average?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const onWatchlist = saved?.status === 'watchlist';
    const isSeen = saved?.status === 'seen';
    const watchlistLabel = isSeen
      ? `${movie.title} is already seen`
      : onWatchlist
        ? `${movie.title} is on your watchlist`
        : `Add ${movie.title} to your watchlist`;
    const seenLabel = isSeen
      ? `${movie.title} is seen`
      : onWatchlist
        ? `Mark ${movie.title} as seen`
        : `Mark ${movie.title} as seen`;
    const bookmarkIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" /></svg>;
    const eyeIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></svg>;
    return (
      <article className="discover-card" key={movie.id}>
        <div className="discover-poster">
          <span className="discover-poster-fallback" aria-hidden="true">{movie.title.slice(0, 1)}</span>
          {poster && <img src={poster} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
          <button className="discover-poster-open" type="button" onClick={() => handleOpenMovie(movie)} aria-label={`View details for ${movie.title}`}>
            <span className="discover-poster-hint">View details</span>
          </button>
          <div className="discover-poster-actions">
            {!isSeen && (
              <button
                className={`discover-poster-action${onWatchlist ? ' saved' : ''}`}
                type="button"
                aria-label={watchlistLabel}
                title={onWatchlist ? 'On watchlist' : 'Add to watchlist'}
                disabled={Boolean(saved)}
                onClick={() => handleAdd(movie, 'watchlist')}
              >
                {bookmarkIcon}
              </button>
            )}
            <button
              className={`discover-poster-action${isSeen ? ' saved' : ''}`}
              type="button"
              aria-label={seenLabel}
              title={isSeen ? 'Seen' : 'Mark as seen'}
              disabled={isSeen}
              onClick={() => handleAdd(movie, 'seen')}
            >
              {eyeIcon}
            </button>
          </div>
        </div>
        <div className="discover-card-copy">
          <h2>{movie.title}</h2>
          <div className="discover-card-meta">
            <span>{movie.release_date?.slice(0, 4) || 'Movie'}</span>
            {typeof movie.vote_average === 'number' && movie.vote_average > 0 && (
              <span className="discover-rating" aria-label={`TMDb score ${vote} out of 10`}>★ {vote}</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="app discover-page" hidden={hidden}>
      <header className={`discover-header${selectedSection ? ' has-section' : ''}`}><h1>{selectedSection ? SECTIONS.find((section) => section.id === selectedSection)?.title : 'Discover'}</h1>
        <div className="discover-header-actions">
          {!selectedSection && !debouncedQuery && <button className="discover-random-button" type="button" onClick={openRandomDialog}>Surprise me</button>}
          {selectedSection && <button className="discover-back" type="button" onClick={closeSection}>← Back</button>}
        </div>
      </header>

      <dialog
        ref={randomDialogRef}
        className="movie-dialog randomizer-dialog"
        aria-labelledby="randomizer-title"
        onCancel={(event) => { event.preventDefault(); closeRandomDialog(); }}
        onClose={closeRandomDialog}
        onClick={(event) => { if (event.target === randomDialogRef.current) closeRandomDialog(); }}
      >
        <div className="randomizer-shell">
          <div className="dialog-head">
            <h2 id="randomizer-title">Surprise me</h2>
            <button type="button" className="close-button" aria-label="Close dialog" onClick={closeRandomDialog}>×</button>
          </div>
          <p className="settings-help randomizer-help">Choose criteria and get a random movie suggestion that is not already in your collection.</p>
          <div className="discover-random-controls">
            <label className="select-control" htmlFor="random-genre"><span className="select-label-text">Genre</span>
              <select id="random-genre" value={String(randomGenre)} onChange={(event) => setRandomGenre(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">All genres</option>
                {MOVIE_GENRES.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
              </select>
            </label>
            <label className="select-control" htmlFor="random-rating"><span className="select-label-text">Rating</span>
              <select id="random-rating" value={String(randomRating)} onChange={(event) => setRandomRating(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">Any rating</option>
                <option value="6">6+ stars</option>
                <option value="7">7+ stars</option>
                <option value="7.5">7.5+ stars</option>
                <option value="8">8+ stars</option>
              </select>
            </label>
            <label className="select-control" htmlFor="random-period"><span className="select-label-text">Period</span>
              <select id="random-period" value={randomPeriod} onChange={(event) => setRandomPeriod(event.target.value as PeriodPreset)}>
                <option value="all">All years</option>
                <option value="classic">Before 1980</option>
                <option value="80s">1980s</option>
                <option value="90s">1990s</option>
                <option value="2000s">2000–2009</option>
                <option value="2010s">2010–2019</option>
                <option value="recent">2020–now</option>
              </select>
            </label>
            <label className="select-control" htmlFor="random-language"><span className="select-label-text">Language</span>
              <select id="random-language" value={randomLanguage} onChange={(event) => setRandomLanguage(event.target.value)}>
                <option value="all">All languages</option>
                {LANGUAGE_OPTIONS.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
              </select>
            </label>
            <button className="discover-primary discover-random-submit" type="button" onClick={pickRandomMovie} disabled={randomLoading}>{randomLoading ? 'Searching…' : randomMovie ? 'Another one' : 'Get suggestion'}</button>
          </div>
          {randomError && <p className="discover-inline-error" role="alert">{randomError}</p>}
          {randomMovie && <div className="discover-random-result" aria-live="polite">{renderCard(randomMovie)}</div>}
        </div>
      </dialog>

      <div className="toolbar discover-toolbar">
        <SearchField value={query} onChange={onQueryChange} label="Search movies to discover" placeholder="Search by movie title…" />
      </div>
      {actionError && <p className="discover-inline-error" role="alert">{actionError}</p>}
      {error && <div className="discover-inline-error" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>}
      {loading ? (
        <div className="discover-grid" role="status" aria-label="Loading movies">{Array.from({ length: 8 }, (_, index) => <div className="discover-skeleton" key={index}><span /><i /><i /></div>)}</div>
      ) : debouncedQuery ? (
        searchResults.length
          ? <section className="discover-all-grid" aria-label="Search results">{searchResults.map(renderCard)}</section>
          : !error && <div className="discover-message discover-empty"><h2>No movies found</h2><p>Try a different title.</p></div>
      ) : selectedSection ? (
        <>
          <section className="discover-all-grid" aria-label={`${SECTIONS.find((section) => section.id === selectedSection)?.title} movies`}>
            {(feeds[selectedSection] || []).map(renderCard)}
          </section>
          {!error && <button className="discover-load-more" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more movies'}</button>}
        </>
      ) : (
        <div className="discover-sections">
          {SECTIONS.map(({ id, title }) => (
            <section className="discover-section" key={id} aria-labelledby={`discover-${id}`}>
              <div className="discover-section-heading">
                <h2 id={`discover-${id}`}>{title}</h2>
                <button type="button" onClick={() => openSection(id)}>View all <span aria-hidden="true">→</span></button>
              </div>
              {feeds[id]?.length ? <div className="discover-rail">{feeds[id].slice(0, 12).map(renderCard)}</div> : (
                <div className="discover-rail discover-rail-skeleton" aria-label={`Loading ${title}`} role="status">
                  {Array.from({ length: 5 }, (_, index) => <div className="discover-skeleton" key={index}><span /><i /><i /></div>)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
