import { useEffect, useMemo, useRef, useState } from 'react';
import { MovieDialog } from './components/MovieDialog';
import { MovieGrid } from './components/MovieGrid';
import { SettingsDialog } from './components/SettingsDialog';
import { MovieDetailsPage } from './components/MovieDetailsPage';
import { DiscoverPage } from './components/DiscoverPage';
import { movieRepository, settingsRepository } from './services/movieRepository';
import { finishTraktAuthorization, getWatchedMovies, type TraktCredentials } from './services/trakt';
import { getMovieDetails } from './services/tmdb';
import type { Movie, MovieDraft, MovieStatus, TmdbMovie } from './types';

type Filter = 'all' | MovieStatus;
type SortOrder = 'newest' | 'oldest' | 'title' | 'year' | 'rating';
type AppTab = 'history' | 'discover';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [movies, setMovies] = useState<Movie[]>(() => movieRepository.getAll());
  const [token, setToken] = useState(() => settingsRepository.getToken());
  const [trakt, setTrakt] = useState<TraktCredentials>(() => settingsRepository.getTrakt());
  const [filter, setFilter] = useState<Filter>('all');
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [yearFilter, setYearFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [movieDialogOpen, setMovieDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie>();
  const [selectedMovie, setSelectedMovie] = useState<Movie>();
  const [selectedDiscoveryMovie, setSelectedDiscoveryMovie] = useState<TmdbMovie>();
  const [storageError, setStorageError] = useState('');
  const [traktNotice, setTraktNotice] = useState('');
  const traktCallbackHandled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const authError = params.get('error');
    if ((!code && !authError) || traktCallbackHandled.current) return;
    traktCallbackHandled.current = true;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

    if (authError) {
      setTraktNotice('Trakt-aanmelding is geannuleerd. Je kunt het koppelen opnieuw starten via Instellingen.');
      return;
    }
    if (!code || !returnedState || !trakt.clientId) {
      setTraktNotice('De Trakt-terugkoppeling is onvolledig. Controleer je Client ID en probeer opnieuw.');
      return;
    }
    finishTraktAuthorization(trakt.clientId, code, returnedState)
      .then((credentials) => {
        settingsRepository.saveTrakt(credentials);
        setTrakt(credentials);
        setTraktNotice('Trakt is gekoppeld. Je kunt nu je kijkgeschiedenis synchroniseren.');
      })
      .catch((reason: unknown) => {
        setTraktNotice(reason instanceof Error ? reason.message : 'Trakt koppelen is mislukt.');
      });
  }, [trakt.clientId]);

  const filteredMovies = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('nl');
    return movies.filter((movie) => {
      const matchesFilter = filter === 'all' || movie.status === filter;
      const matchesQuery = !search || `${movie.title} ${movie.year || ''} ${movie.note || ''}`.toLocaleLowerCase('nl').includes(search);
      const matchesYear = yearFilter === 'all' || movie.year === yearFilter;
      return matchesFilter && matchesQuery && matchesYear;
    }).sort((a, b) => {
      if (sortOrder === 'oldest') return a.addedAt - b.addedAt;
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'nl');
      if (sortOrder === 'year') return (Number(b.year) || 0) - (Number(a.year) || 0) || a.title.localeCompare(b.title, 'nl');
      if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0) || b.addedAt - a.addedAt;
      return b.addedAt - a.addedAt;
    });
  }, [filter, movies, query, sortOrder, yearFilter]);

  const years = useMemo(() => [...new Set(movies.map((movie) => movie.year).filter((year): year is string => Boolean(year)))].sort((a, b) => Number(b) - Number(a)), [movies]);
  function persist(next: Movie[]) {
    try {
      movieRepository.saveAll(next);
      setMovies(next);
      setStorageError('');
      return true;
    } catch {
      setStorageError('Opslaan lukt niet. Controleer de vrije opslagruimte op dit toestel.');
      return false;
    }
  }

  function handleSave(draft: MovieDraft): string | null {
    const duplicate = movies.find((movie) => {
      if (movie.id === editingMovie?.id) return false;
      return (draft.tmdbId && movie.tmdbId === draft.tmdbId)
        || movie.title.toLocaleLowerCase('nl') === draft.title.toLocaleLowerCase('nl');
    });
    if (duplicate) return `“${duplicate.title}” staat al in je collectie. Je kunt die film bewerken.`;

    const old = editingMovie;
    const nextMovie: Movie = {
      id: old?.id || createId(),
      title: draft.title,
      year: draft.year || undefined,
      status: draft.status,
      rating: draft.status === 'seen' ? draft.rating : undefined,
      note: draft.note || undefined,
      tmdbId: draft.tmdbId,
      posterPath: draft.posterPath,
      palette: old?.palette ?? Math.floor(Math.random() * 8),
      addedAt: old?.addedAt ?? Date.now(),
    };
    const next = old ? movies.map((movie) => movie.id === old.id ? nextMovie : movie) : [...movies, nextMovie];
    if (!persist(next)) return 'Opslaan lukte niet. Controleer de vrije opslagruimte op dit toestel.';
    setMovieDialogOpen(false);
    setEditingMovie(undefined);
    return null;
  }

  function openAddDialog() {
    setEditingMovie(undefined);
    setMovieDialogOpen(true);
  }

  function findSavedMovie(movie: TmdbMovie) {
    const year = movie.release_date?.slice(0, 4);
    return movies.find((saved) => saved.tmdbId === movie.id
      || (saved.title.toLocaleLowerCase('nl') === movie.title.toLocaleLowerCase('nl') && saved.year === year));
  }

  function saveDiscoveredMovie(movie: TmdbMovie): Movie | undefined {
    const existing = findSavedMovie(movie);
    if (existing) return existing;
    const saved: Movie = {
      id: createId(),
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date?.slice(0, 4),
      status: 'watchlist',
      posterPath: movie.poster_path || undefined,
      palette: Math.floor(Math.random() * 8),
      addedAt: Date.now(),
    };
    return persist([...movies, saved]) ? saved : undefined;
  }

  function openDiscoveredDetails(movie: TmdbMovie) {
    const saved = findSavedMovie(movie);
    if (saved) {
      setSelectedDiscoveryMovie(undefined);
      setSelectedMovie(saved);
      return;
    }
    setSelectedDiscoveryMovie(movie);
    setSelectedMovie({
      id: `discover-${movie.id}`,
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date?.slice(0, 4),
      status: 'watchlist',
      posterPath: movie.poster_path || undefined,
      palette: 0,
      addedAt: Date.now(),
    });
  }

  function addDiscoveredFromDetails() {
    if (!selectedDiscoveryMovie) return;
    const saved = saveDiscoveredMovie(selectedDiscoveryMovie);
    if (saved) {
      setSelectedMovie(saved);
      setSelectedDiscoveryMovie(undefined);
    }
  }

  function openEditDialog(movie: Movie) {
    setEditingMovie(movie);
    setMovieDialogOpen(true);
  }

  function closeMovieDialog() {
    setMovieDialogOpen(false);
    setEditingMovie(undefined);
  }

  function removeMovie(id: string) {
    const movie = movies.find((item) => item.id === id);
    if (!movie || !window.confirm(`“${movie.title}” verwijderen uit je collectie?`)) return;
    persist(movies.filter((item) => item.id !== id));
  }

  function saveToken(value: string) {
    try {
      settingsRepository.saveToken(value);
      setToken(value);
      setSettingsOpen(false);
    } catch {
      setStorageError('De token kon niet lokaal worden opgeslagen.');
    }
  }

  function removeToken() {
    settingsRepository.clearToken();
    setToken('');
    setSettingsOpen(false);
  }

  function saveTraktCredentials(clientId: string) {
    const next = { clientId, accessToken: '', refreshToken: '', expiresAt: 0 };
    settingsRepository.saveTrakt(next);
    setTrakt(next);
  }

  async function syncTraktMovies(): Promise<number> {
    if (!trakt.clientId || !trakt.accessToken) throw new Error('Koppel eerst je Trakt-account.');
    const watched = await getWatchedMovies(trakt, (updated) => {
      settingsRepository.saveTrakt(updated);
      setTrakt(updated);
    });
    const next = [...movies];
    let changed = 0;
    for (const item of watched) {
      const entry = item.movie;
      if (!entry?.title) continue;
      const tmdbId = entry.ids?.tmdb;
      const matchIndex = next.findIndex((movie) => (tmdbId && movie.tmdbId === tmdbId)
        || (movie.title.toLocaleLowerCase('nl') === entry.title.toLocaleLowerCase('nl') && movie.year === (entry.year ? String(entry.year) : undefined)));
      if (matchIndex >= 0) {
        const old = next[matchIndex];
        let updated = old.status === 'seen' ? old : { ...old, status: 'seen' as const };
        if (!updated.posterPath && tmdbId && token) {
          try {
            const details = await getMovieDetails(tmdbId, token, new AbortController().signal);
            if (details.poster_path) updated = { ...updated, posterPath: details.poster_path };
          } catch { /* Keep the local film even if TMDb is temporarily unavailable. */ }
        }
        if (updated !== old) {
          next[matchIndex] = updated;
          changed += 1;
        }
        continue;
      }
      let posterPath: string | undefined;
      if (tmdbId && token) {
        try {
          const details = await getMovieDetails(tmdbId, token, new AbortController().signal);
          posterPath = details.poster_path || undefined;
        } catch { /* Poster lookup is optional; the movie still imports. */ }
      }
      next.push({
        id: createId(), tmdbId, title: entry.title,
        year: entry.year ? String(entry.year) : undefined,
        posterPath,
        status: 'seen', palette: Math.floor(Math.random() * 8),
        addedAt: item.last_watched_at ? Date.parse(item.last_watched_at) || Date.now() : Date.now(),
      });
      changed += 1;
    }
    if (changed && !persist(next)) throw new Error('Synchroniseren lukte niet. Controleer de vrije opslagruimte op dit toestel.');
    return changed;
  }

  return (
    <>
      {!selectedMovie && <header className="desktop-appbar">
        <a className="desktop-brand" href="./" aria-label="Frame">frame<span>.</span></a>
        <nav className="desktop-main-nav" aria-label="Hoofdnavigatie">
          <button type="button" className={activeTab === 'history' ? 'active' : ''} aria-current={activeTab === 'history' ? 'page' : undefined} onClick={() => setActiveTab('history')}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9L3.5 8.5" /><path d="M3.5 4.5v4h4M12 7v5l3.2 2" /></svg>
            <span>Geschiedenis</span>
          </button>
          <button type="button" className={activeTab === 'discover' ? 'active' : ''} aria-current={activeTab === 'discover' ? 'page' : undefined} onClick={() => setActiveTab('discover')}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" /></svg>
            <span>Ontdekken</span>
          </button>
        </nav>
        <button className="desktop-settings" type="button" aria-label="TMDb-instellingen" title="TMDb-instellingen" onClick={() => setSettingsOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </header>}
      {!selectedMovie && <header className="mobile-appbar">
        <a className="mobile-brand" href="./" aria-label="Frame — filmcollectie">frame<span aria-hidden="true">.</span></a>
        <button className="mobile-settings" type="button" aria-label="TMDb-instellingen" onClick={() => setSettingsOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </header>}
      {selectedMovie ? <MovieDetailsPage
        movie={selectedMovie}
        token={token}
        discoveryPreview={Boolean(selectedDiscoveryMovie)}
        onAddToWatchlist={addDiscoveredFromDetails}
        onBack={() => { setSelectedMovie(undefined); setSelectedDiscoveryMovie(undefined); }}
      /> : activeTab === 'discover' ? <DiscoverPage
        token={token}
        collection={movies}
        onAdd={(movie) => Boolean(saveDiscoveredMovie(movie))}
        onOpen={openDiscoveredDetails}
        onSettings={() => setSettingsOpen(true)}
      /> : <main className="app">
        <section className="collection" aria-label="Filmcollectie">
          <div className="mobile-collection-heading">
            <h1>Mijn films</h1>
            <span>{movies.length}</span>
          </div>
          <div className="toolbar">
            <label className="search-box">
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" /><path d="m13.2 13.2 4 4" /></svg>
              <input type="search" aria-label="Zoek films" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="filters" role="group" aria-label="Filter films">
                {([['all', 'Alles'], ['seen', 'Gezien'], ['watchlist', 'Te zien']] as const).map(([value, label]) => (
                  <button key={value} className={`filter${filter === value ? ' active' : ''}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                    {label}<span className="filter-count">{value === 'all' ? movies.length : movies.filter((movie) => movie.status === value).length}</span>
                  </button>
                ))}
            </div>
            <div className="collection-controls">
              <label className="select-control">Jaar
                <select aria-label="Filter op jaar" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                  <option value="all">Alle jaren</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="select-control">Sorteren
                <select aria-label="Sorteer films" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                  <option value="newest">Nieuw toegevoegd</option>
                  <option value="oldest">Oudst toegevoegd</option>
                  <option value="title">Titel A–Z</option>
                  <option value="year">Jaar: nieuw naar oud</option>
                  <option value="rating">Hoogste beoordeling</option>
                </select>
              </label>
            </div>
          </div>
          {storageError && <p className="storage-error" role="alert">{storageError}</p>}
          {traktNotice && <p className="trakt-message" role="status">{traktNotice}</p>}
          <MovieGrid
            movies={filteredMovies}
            hasMovies={movies.length > 0}
            searching={false}
            emptyMessage={query && !filteredMovies.length ? 'Geen zoekresultaten' : undefined}
            onEdit={openEditDialog}
            onDelete={removeMovie}
            onOpen={setSelectedMovie}
          />
        </section>
      </main>}
      {!selectedMovie && activeTab === 'history' && <button className="floating-add-button" type="button" aria-label="Film toevoegen" title="Film toevoegen" onClick={openAddDialog}>+</button>}
      {!selectedMovie && <div className="mobile-bottom-actions">
      <nav className="mobile-bottom-tabs" aria-label="Hoofdnavigatie">
        <button type="button" className={activeTab === 'history' ? 'active' : ''} aria-current={activeTab === 'history' ? 'page' : undefined} onClick={() => setActiveTab('history')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9L3.5 8.5" /><path d="M3.5 4.5v4h4M12 7v5l3.2 2" /></svg>
          <span className="sr-only">Geschiedenis</span>
        </button>
        <button type="button" className={activeTab === 'discover' ? 'active' : ''} aria-current={activeTab === 'discover' ? 'page' : undefined} onClick={() => setActiveTab('discover')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" /></svg>
          <span className="sr-only">Ontdekken</span>
        </button>
      </nav>
      <button className="mobile-add-button" type="button" aria-label="Film toevoegen" title="Film toevoegen" onClick={openAddDialog}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      </div>}
      <p className="tmdb-credit">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <MovieDialog open={movieDialogOpen} token={token} movie={editingMovie} onClose={closeMovieDialog} onSave={handleSave} />
      <SettingsDialog open={settingsOpen} token={token} onClose={() => setSettingsOpen(false)} onSave={saveToken} onRemove={removeToken}
        trakt={trakt} onSaveTrakt={saveTraktCredentials} onSyncTrakt={syncTraktMovies} />
    </>
  );
}
