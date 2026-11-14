import { useEffect, useState } from 'react';
import { getDiscoveryMovies, searchMovies, tmdbPoster, type DiscoveryCategory } from '../services/tmdb';
import type { Movie, TmdbMovie } from '../types';

interface Props {
  token: string;
  collection: Movie[];
  onAdd(movie: TmdbMovie): boolean;
  onOpen(movie: TmdbMovie): void;
  onSettings(): void;
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

export function DiscoverPage({ token, collection, onAdd, onOpen, onSettings }: Props) {
  const [query, setQuery] = useState('');
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!token) {
      setFeeds({});
      setSearchResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (debouncedQuery) {
      searchMovies(debouncedQuery, token, controller.signal)
        .then((results) => { if (!controller.signal.aborted) setSearchResults(results); })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Films laden is niet gelukt.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else if (selectedSection) {
      setPage(1);
      getDiscoveryMovies(selectedSection, token, controller.signal)
        .then((results) => { if (!controller.signal.aborted) setFeeds((current) => ({ ...current, [selectedSection]: results })); })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Films laden is niet gelukt.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      Promise.all(SECTIONS.map(async ({ id }) => [id, await getDiscoveryMovies(id, token, controller.signal)] as const))
        .then((results) => {
          if (!controller.signal.aborted) setFeeds(Object.fromEntries(results) as Record<DiscoveryCategory, TmdbMovie[]>);
        })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Films laden is niet gelukt.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [debouncedQuery, retry, selectedSection, token]);

  async function loadMore() {
    if (!selectedSection || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const results = await getDiscoveryMovies(selectedSection, token, new AbortController().signal, undefined, nextPage);
      setFeeds((current) => ({ ...current, [selectedSection]: [...(current[selectedSection] || []), ...results] }));
      setPage(nextPage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Meer films laden is niet gelukt.');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleAdd(movie: TmdbMovie) {
    setActionError('');
    if (!onAdd(movie)) setActionError('Opslaan lukte niet. Controleer de beschikbare opslagruimte op dit toestel.');
  }

  function renderCard(movie: TmdbMovie) {
    const saved = matchingMovie(movie, collection);
    const poster = tmdbPoster(movie.poster_path, 'w342');
    return (
      <article className="discover-card" key={movie.id}>
        <div className="discover-poster">
          {poster ? <img src={poster} alt="" loading="lazy" /> : <span className="discover-poster-fallback">{movie.title.slice(0, 1)}</span>}
          <button className="discover-poster-open" type="button" onClick={() => onOpen(movie)} aria-label={`Bekijk details van ${movie.title}`}>
            <span className="discover-poster-hint">Bekijk details</span>
          </button>
          <button
            className={`discover-poster-add${saved ? ' saved' : ''}`}
            type="button"
            aria-label={saved ? `${movie.title} staat ${saved.status === 'seen' ? 'bij Gezien' : 'op je kijklijst'}` : `Voeg ${movie.title} toe aan je kijklijst`}
            title={saved ? (saved.status === 'seen' ? 'Gezien' : 'Op kijklijst') : 'Toevoegen aan kijklijst'}
            disabled={Boolean(saved)}
            onClick={() => handleAdd(movie)}
          >
            {saved
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>}
          </button>
        </div>
        <div className="discover-card-copy">
          <h2>{movie.title}</h2>
          <div className="discover-card-meta">
            <span>{movie.release_date?.slice(0, 4) || 'Film'}</span>
            {typeof movie.vote_average === 'number' && movie.vote_average > 0 && (
              <span className="discover-rating" aria-label={`TMDb-score ${movie.vote_average.toFixed(1)} op 10`}>★ {movie.vote_average.toFixed(1)}</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="app discover-page">
      <header className="discover-header"><h1>{selectedSection ? SECTIONS.find((section) => section.id === selectedSection)?.title : 'Ontdekken'}</h1>
        {selectedSection && <button className="discover-back" type="button" onClick={() => { setSelectedSection(undefined); setError(''); }}>← Terug</button>}
      </header>

      {!token ? (
        <section className="discover-message" aria-labelledby="discover-setup-title">
          <div className="discover-message-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 3 19.5 12.5 29 16l-9.5 3.5L16 29l-3.5-9.5L3 16l9.5-3.5L16 3Z" /></svg></div>
          <h2 id="discover-setup-title">Koppel TMDb om films te ontdekken</h2>
          <p>Ontdekken gebruikt TMDb en werkt met een internetverbinding. Je eigen filmcollectie blijft ook offline beschikbaar.</p>
          <button type="button" className="discover-primary" onClick={onSettings}>TMDb instellen</button>
        </section>
      ) : (
        <>
          <label className="discover-search">
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" /><path d="m13.2 13.2 4 4" /></svg>
            <input type="search" aria-label="Zoek films om te ontdekken" placeholder="Zoek op filmtitel…" value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" aria-label="Zoekopdracht wissen" onClick={() => setQuery('')}>×</button>}
          </label>
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
                    <button type="button" onClick={() => { setSelectedSection(id); setError(''); }}>Bekijk alles <span aria-hidden="true">→</span></button>
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
        </>
      )}
    </main>
  );
}
