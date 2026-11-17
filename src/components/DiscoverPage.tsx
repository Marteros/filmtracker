import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getDiscoveryMovies, searchMovies, tmdbPoster, type DiscoveryCategory } from '../services/tmdb';
import { SearchField } from './SearchField';
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
  { id: 'popular', title: 'Populair' },
  { id: 'top_rated', title: 'Hoog gewaardeerd' },
];

function matchingMovie(movie: TmdbMovie, collection: Movie[]) {
  const year = movie.release_date?.slice(0, 4);
  return collection.find((saved) => saved.tmdbId === movie.id
    || (saved.title.toLocaleLowerCase('nl') === movie.title.toLocaleLowerCase('nl') && saved.year === year));
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
  const overviewScrollRef = useRef(0);
  const restoreOverviewScrollRef = useRef<number | null>(null);
  const sectionHistoryRef = useRef(false);

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
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Films laden is niet gelukt.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else if (selectedSection) {
      setPage(1);
      getDiscoveryMovies(selectedSection, controller.signal)
        .then((results) => { if (!controller.signal.aborted) setFeeds((current) => ({ ...current, [selectedSection]: results })); })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Films laden is niet gelukt.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      Promise.all(SECTIONS.map(async ({ id }) => [id, await getDiscoveryMovies(id, controller.signal)] as const))
        .then((results) => {
          if (!controller.signal.aborted) setFeeds(Object.fromEntries(results) as Record<DiscoveryCategory, TmdbMovie[]>);
        })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Films laden is niet gelukt.'); })
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
      setError(reason instanceof Error ? reason.message : 'Meer films laden is niet gelukt.');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleAdd(movie: TmdbMovie, status: 'seen' | 'watchlist') {
    setActionError('');
    if (!onAdd(movie, status)) setActionError('Opslaan lukte niet. Controleer de beschikbare opslagruimte op dit toestel.');
  }

  function renderCard(movie: TmdbMovie) {
    const saved = matchingMovie(movie, collection);
    const poster = tmdbPoster(movie.poster_path, 'w342');
    const vote = movie.vote_average?.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const onWatchlist = saved?.status === 'watchlist';
    const isSeen = saved?.status === 'seen';
    const watchlistLabel = isSeen
      ? `${movie.title} is al gezien`
      : onWatchlist
        ? `${movie.title} staat op je kijklijst`
        : `Voeg ${movie.title} toe aan je kijklijst`;
    const seenLabel = isSeen
      ? `${movie.title} is gezien`
      : onWatchlist
        ? `Markeer ${movie.title} als gezien`
        : `Markeer ${movie.title} als gezien`;
    const checkIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
    const bookmarkIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" /></svg>;
    const eyeIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></svg>;
    return (
      <article className="discover-card" key={movie.id}>
        <div className="discover-poster">
          <span className="discover-poster-fallback" aria-hidden="true">{movie.title.slice(0, 1)}</span>
          {poster && <img src={poster} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
          <button className="discover-poster-open" type="button" onClick={() => onOpen(movie)} aria-label={`Bekijk details van ${movie.title}`}>
            <span className="discover-poster-hint">Bekijk details</span>
          </button>
          <div className="discover-poster-actions">
            <button
              className={`discover-poster-action${onWatchlist ? ' saved' : ''}`}
              type="button"
              aria-label={watchlistLabel}
              title={onWatchlist ? 'Op kijklijst' : isSeen ? 'Gezien' : 'Toevoegen aan kijklijst'}
              disabled={Boolean(saved)}
              onClick={() => handleAdd(movie, 'watchlist')}
            >
              {onWatchlist ? checkIcon : bookmarkIcon}
            </button>
            <button
              className={`discover-poster-action${isSeen ? ' saved' : ''}`}
              type="button"
              aria-label={seenLabel}
              title={isSeen ? 'Gezien' : 'Markeer als gezien'}
              disabled={isSeen}
              onClick={() => handleAdd(movie, 'seen')}
            >
              {isSeen ? checkIcon : eyeIcon}
            </button>
          </div>
        </div>
        <div className="discover-card-copy">
          <h2>{movie.title}</h2>
          <div className="discover-card-meta">
            <span>{movie.release_date?.slice(0, 4) || 'Film'}</span>
            {typeof movie.vote_average === 'number' && movie.vote_average > 0 && (
              <span className="discover-rating" aria-label={`TMDb-score ${vote} op 10`}>★ {vote}</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="app discover-page" hidden={hidden}>
      <header className={`discover-header${selectedSection ? ' has-section' : ''}`}><h1>{selectedSection ? SECTIONS.find((section) => section.id === selectedSection)?.title : 'Ontdekken'}</h1>
        {selectedSection && <button className="discover-back" type="button" onClick={closeSection}>← Terug</button>}
      </header>

      <div className="toolbar discover-toolbar">
        <SearchField value={query} onChange={onQueryChange} label="Zoek films om te ontdekken" placeholder="Zoek op filmtitel…" />
      </div>
      {actionError && <p className="discover-inline-error" role="alert">{actionError}</p>}
      {error && <div className="discover-inline-error" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Opnieuw proberen</button></div>}
      {loading ? (
        <div className="discover-grid" role="status" aria-label="Films laden">{Array.from({ length: 8 }, (_, index) => <div className="discover-skeleton" key={index}><span /><i /><i /></div>)}</div>
      ) : debouncedQuery ? (
        searchResults.length
          ? <section className="discover-all-grid" aria-label="Zoekresultaten">{searchResults.map(renderCard)}</section>
          : !error && <div className="discover-message discover-empty"><h2>Geen films gevonden</h2><p>Probeer een andere titel.</p></div>
      ) : selectedSection ? (
        <>
          <section className="discover-all-grid" aria-label={`${SECTIONS.find((section) => section.id === selectedSection)?.title} films`}>
            {(feeds[selectedSection] || []).map(renderCard)}
          </section>
          {!error && <button className="discover-load-more" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Laden…' : 'Meer films laden'}</button>}
        </>
      ) : (
        <div className="discover-sections">
          {SECTIONS.map(({ id, title }) => (
            <section className="discover-section" key={id} aria-labelledby={`discover-${id}`}>
              <div className="discover-section-heading">
                <h2 id={`discover-${id}`}>{title}</h2>
                <button type="button" onClick={() => openSection(id)}>Bekijk alles <span aria-hidden="true">→</span></button>
              </div>
              {feeds[id]?.length ? <div className="discover-rail">{feeds[id].slice(0, 12).map(renderCard)}</div> : (
                <div className="discover-rail discover-rail-skeleton" aria-label={`${title} laden`} role="status">
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
