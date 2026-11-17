import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MovieDialog } from './components/MovieDialog';
import { MovieGrid } from './components/MovieGrid';
import { SettingsDialog } from './components/SettingsDialog';
import { MovieDetailsPage } from './components/MovieDetailsPage';
import { DiscoverPage } from './components/DiscoverPage';
import { SearchField } from './components/SearchField';
import { InsightsPage } from './components/InsightsPage';
import { AgendaPage } from './components/AgendaPage';
import { movieRepository, settingsRepository } from './services/movieRepository';
import { beginTraktAuthorization, finishTraktAuthorization, getWatchedMovies, getWatchlistMovies, TRAKT_CLIENT_ID, type TraktCredentials, type TraktMovieRef } from './services/trakt';
import { getMovieDetails } from './services/tmdb';
import { downloadBackup, importBackup, type ImportMode } from './services/backup';
import type { Movie, MovieDraft, TmdbMovie } from './types';

type SortOrder = 'newest' | 'oldest' | 'title' | 'year' | 'rating';
type AppTab = 'history' | 'watchlist' | 'discover' | 'insights';
type CollectionView = 'grid' | 'list';
const COLLECTION_VIEW_KEY = 'frame-collection-view-v1';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [movies, setMovies] = useState<Movie[]>(() => movieRepository.getAll());
  const [trakt, setTrakt] = useState<TraktCredentials>(() => settingsRepository.getTrakt());
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [discoverMounted, setDiscoverMounted] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [yearFilter, setYearFilter] = useState('all');
  const [collectionView, setCollectionView] = useState<CollectionView>(() => {
    try { return localStorage.getItem(COLLECTION_VIEW_KEY) === 'list' ? 'list' : 'grid'; }
    catch { return 'grid'; }
  });
  const [query, setQuery] = useState('');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [movieDialogOpen, setMovieDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie>();
  const [selectedMovie, setSelectedMovie] = useState<Movie>();
  const [selectedDiscoveryMovie, setSelectedDiscoveryMovie] = useState<TmdbMovie>();
  const [storageError, setStorageError] = useState('');
  const [traktNotice, setTraktNotice] = useState('');
  const traktCallbackHandled = useRef(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const detailsHistoryRef = useRef(false);
  const agendaHistoryRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const authError = params.get('error');
    if ((!code && !authError) || traktCallbackHandled.current) return;
    traktCallbackHandled.current = true;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

    if (authError) {
      setTraktNotice('Trakt sign-in was cancelled. You can start connecting again via Settings.');
      return;
    }
    const clientId = trakt.clientId || TRAKT_CLIENT_ID;
    if (!code || !returnedState || !clientId) {
      setTraktNotice('The Trakt callback is incomplete. Check the Trakt Client ID in the app and try again.');
      return;
    }
    finishTraktAuthorization(clientId, code, returnedState)
      .then((credentials) => {
        settingsRepository.saveTrakt(credentials);
        setTrakt(credentials);
        setTraktNotice('Trakt is connected. You can now sync your watch history and watchlist.');
      })
      .catch((reason: unknown) => {
        setTraktNotice(reason instanceof Error ? reason.message : 'Could not connect Trakt.');
      });
  }, [trakt.clientId]);

  useEffect(() => {
    setMobileFiltersOpen(false);
    setMobileSearchOpen(false);
  }, [activeTab, selectedMovie, agendaOpen]);

  useEffect(() => {
    const element = filterDialogRef.current;
    if (!element) return;
    if (mobileFiltersOpen && !element.open) element.showModal();
    if (!mobileFiltersOpen && element.open) element.close();
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    let armed = false;
    const timer = window.setTimeout(() => { armed = true; }, 300);
    function closeOnScroll() {
      if (!armed) return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setMobileSearchOpen(false);
    }
    window.addEventListener('scroll', closeOnScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', closeOnScroll);
    };
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (activeTab === 'discover') setDiscoverMounted(true);
  }, [activeTab]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      if (detailsHistoryRef.current) {
        if (event.state?.frameDetails) return;
        detailsHistoryRef.current = false;
        setSelectedMovie(undefined);
        setSelectedDiscoveryMovie(undefined);
        return;
      }
      if (agendaHistoryRef.current) {
        if (event.state?.frameAgenda) return;
        agendaHistoryRef.current = false;
        setAgendaOpen(false);
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isWatchlist = activeTab === 'watchlist';
  const statusMovies = useMemo(
    () => movies.filter((movie) => movie.status === (isWatchlist ? 'watchlist' : 'seen')),
    [isWatchlist, movies],
  );

  const visibleMovies = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return statusMovies.filter((movie) => {
      const matchesQuery = !search || `${movie.title} ${movie.year || ''} ${movie.note || ''}`.toLocaleLowerCase().includes(search);
      const matchesYear = yearFilter === 'all' || movie.year === yearFilter;
      return matchesQuery && matchesYear;
    }).sort((a, b) => {
      if (sortOrder === 'oldest') return a.addedAt - b.addedAt;
      if (sortOrder === 'title') return a.title.localeCompare(b.title);
      if (sortOrder === 'year') return (Number(b.year) || 0) - (Number(a.year) || 0) || a.title.localeCompare(b.title);
      if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0) || b.addedAt - a.addedAt;
      return b.addedAt - a.addedAt;
    });
  }, [query, sortOrder, statusMovies, yearFilter]);

  const collectionCount = statusMovies.length;

  const years = useMemo(() => [...new Set(statusMovies.map((movie) => movie.year).filter((year): year is string => Boolean(year)))].sort((a, b) => Number(b) - Number(a)), [statusMovies]);
  function persist(next: Movie[]) {
    try {
      movieRepository.saveAll(next);
      setMovies(next);
      setStorageError('');
      return true;
    } catch {
      setStorageError('Could not save. Check the available storage on this device.');
      return false;
    }
  }

  function parseWatchedAt(value?: string): number | undefined {
    if (!value) return undefined;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d).getTime();
  }

  function handleSave(draft: MovieDraft): string | null {
    const duplicate = movies.find((movie) => {
      if (movie.id === editingMovie?.id) return false;
      return (draft.tmdbId && movie.tmdbId === draft.tmdbId)
        || movie.title.toLocaleLowerCase() === draft.title.toLocaleLowerCase();
    });
    if (duplicate) return `“${duplicate.title}” is already in your collection. You can edit that movie.`;

    const old = editingMovie;
    const watchedAt = draft.status === 'seen' ? (parseWatchedAt(draft.watchedAt) ?? old?.watchedAt ?? Date.now()) : undefined;
    const nextMovie: Movie = {
      id: old?.id || createId(),
      title: draft.title,
      year: draft.year || undefined,
      releaseDate: draft.releaseDate || old?.releaseDate,
      status: draft.status,
      rating: draft.status === 'seen' ? draft.rating : undefined,
      note: draft.note || undefined,
      tmdbId: draft.tmdbId,
      posterPath: draft.posterPath || old?.posterPath,
      palette: old?.palette ?? Math.floor(Math.random() * 8),
      addedAt: old?.addedAt ?? Date.now(),
      watchedAt,
      runtime: draft.runtime ?? old?.runtime,
      genres: draft.genres ?? old?.genres,
    };
    const next = old ? movies.map((movie) => movie.id === old.id ? nextMovie : movie) : [...movies, nextMovie];
    if (!persist(next)) return 'Could not save. Check the available storage on this device.';
    if (old && selectedMovie?.id === old.id) setSelectedMovie(nextMovie);
    setMovieDialogOpen(false);
    setEditingMovie(undefined);
    return null;
  }

  function openAddDialog() {
    setMobileFiltersOpen(false);
    setMobileSearchOpen(false);
    setEditingMovie(undefined);
    setMovieDialogOpen(true);
  }

  function switchTab(tab: AppTab) {
    if (tab === 'discover') setDiscoverMounted(true);
    if (tab !== activeTab) setActiveTab(tab);
    window.scrollTo(0, 0);
  }

  function openAgenda() {
    if (agendaOpen) return;
    setAgendaOpen(true);
    if (!agendaHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameAgenda: true }, '');
      agendaHistoryRef.current = true;
    }
  }

  function closeAgenda() {
    if (agendaHistoryRef.current) {
      window.history.back();
      return;
    }
    setAgendaOpen(false);
  }

  function openMovie(movie: Movie) {
    setSelectedDiscoveryMovie(undefined);
    setSelectedMovie(movie);
    if (!detailsHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameDetails: true }, '');
      detailsHistoryRef.current = true;
    }
  }

  function openMovieFromAgenda(movie: Movie) {
    if (agendaHistoryRef.current) {
      agendaHistoryRef.current = false;
      setAgendaOpen(false);
      window.history.replaceState({ ...(window.history.state || {}), frameDetails: true }, '');
      detailsHistoryRef.current = true;
      setSelectedDiscoveryMovie(undefined);
      setSelectedMovie(movie);
      return;
    }
    setAgendaOpen(false);
    openMovie(movie);
  }

  function closeDetails() {
    if (detailsHistoryRef.current) {
      window.history.back();
      return;
    }
    setSelectedMovie(undefined);
    setSelectedDiscoveryMovie(undefined);
  }

  function changeYearFilter(value: string) {
    setYearFilter(value);
    window.scrollTo(0, 0);
  }

  function changeSortOrder(value: SortOrder) {
    setSortOrder(value);
    window.scrollTo(0, 0);
  }

  function resetFilters() {
    setYearFilter('all');
    setSortOrder('newest');
    window.scrollTo(0, 0);
  }

  function changeCollectionView(view: CollectionView) {
    setCollectionView(view);
    try { localStorage.setItem(COLLECTION_VIEW_KEY, view); } catch { /* voorkeur lokaal bewaren */ }
  }

  function ViewToggle({ className = '' }: { className?: string }) {
    return (
      <div className={`view-toggle ${className}`.trim()} role="group" aria-label="View">
        <button type="button" className={collectionView === 'grid' ? 'active' : ''} aria-pressed={collectionView === 'grid'} aria-label="Grid view" title="Grid view" onClick={() => changeCollectionView('grid')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
        </button>
        <button type="button" className={collectionView === 'list' ? 'active' : ''} aria-pressed={collectionView === 'list'} aria-label="List view" title="List view" onClick={() => changeCollectionView('list')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
        </button>
      </div>
    );
  }

  function findSavedMovie(movie: TmdbMovie) {
    const year = movie.release_date?.slice(0, 4);
    return movies.find((saved) => saved.tmdbId === movie.id
      || (saved.title.toLocaleLowerCase() === movie.title.toLocaleLowerCase() && saved.year === year));
  }

  function saveDiscoveredMovie(movie: TmdbMovie, status: 'seen' | 'watchlist' = 'watchlist'): Movie | undefined {
    const existing = findSavedMovie(movie);
    if (existing) {
      if (status === 'seen' && existing.status === 'watchlist') {
        const updated: Movie = { ...existing, status: 'seen', watchedAt: existing.watchedAt ?? Date.now() };
        return persist(movies.map((movieItem) => movieItem.id === existing.id ? updated : movieItem)) ? updated : undefined;
      }
      return existing;
    }
    const saved: Movie = {
      id: createId(),
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date?.slice(0, 4),
      releaseDate: movie.release_date || undefined,
      status,
      posterPath: movie.poster_path || undefined,
      palette: Math.floor(Math.random() * 8),
      addedAt: Date.now(),
      watchedAt: status === 'seen' ? Date.now() : undefined,
    };
    return persist([...movies, saved]) ? saved : undefined;
  }

  function openDiscoveredDetails(movie: TmdbMovie) {
    const saved = findSavedMovie(movie);
    if (saved) {
      setSelectedDiscoveryMovie(undefined);
      setSelectedMovie(saved);
    } else {
      setSelectedDiscoveryMovie(movie);
      setSelectedMovie({
        id: `discover-${movie.id}`,
        tmdbId: movie.id,
        title: movie.title,
        year: movie.release_date?.slice(0, 4),
        releaseDate: movie.release_date || undefined,
        status: 'watchlist',
        posterPath: movie.poster_path || undefined,
        palette: 0,
        addedAt: Date.now(),
      });
    }
    if (!detailsHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameDetails: true }, '');
      detailsHistoryRef.current = true;
    }
  }

  function setMovieStatusFromDetails(movie: Movie, status: 'seen' | 'watchlist'): boolean {
    if (selectedDiscoveryMovie) {
      const saved = saveDiscoveredMovie(selectedDiscoveryMovie, status);
      if (saved) {
        setSelectedMovie(saved);
        setSelectedDiscoveryMovie(undefined);
      }
      return Boolean(saved);
    }
    const nextMovie: Movie = {
      ...movie,
      status,
      watchedAt: status === 'seen' ? (movie.watchedAt ?? Date.now()) : undefined,
      rating: status === 'seen' ? movie.rating : undefined,
    };
    const next = movies.map((item) => item.id === movie.id ? nextMovie : item);
    if (!persist(next)) return false;
    setSelectedMovie(nextMovie);
    return true;
  }

  function setMovieRatingFromDetails(movie: Movie, rating?: Movie['rating']) {
    if (movie.status !== 'seen') return;
    const nextMovie: Movie = { ...movie, rating };
    const next = movies.map((item) => item.id === movie.id ? nextMovie : item);
    if (persist(next)) setSelectedMovie(nextMovie);
  }

  function removeMovieFromDetails(id: string): boolean {
    const movie = movies.find((item) => item.id === id);
    if (!movie) return false;
    if (!persist(movies.filter((item) => item.id !== id))) {
      setStorageError('Could not save. Check the available storage on this device.');
      return false;
    }
    return true;
  }

  function openEditDialog(movie: Movie) {
    setEditingMovie(movie);
    setMovieDialogOpen(true);
  }

  function closeMovieDialog() {
    setMovieDialogOpen(false);
    setEditingMovie(undefined);
  }

  function removeMovie(id: string): boolean {
    const movie = movies.find((item) => item.id === id);
    if (!movie || !window.confirm(`Remove “${movie.title}” from your collection?`)) return false;
    return persist(movies.filter((item) => item.id !== id));
  }

  const enrichMovie = useCallback((id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>) => {
    setMovies((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
      try { movieRepository.saveAll(next); } catch { /* ignore */ }
      return next;
    });
    setSelectedMovie((current) => (current && current.id === id ? { ...current, ...patch } : current));
  }, []);

  async function connectTrakt() {
    if (!TRAKT_CLIENT_ID) throw new Error('Trakt is not configured yet. Add a Trakt Client ID in the app code.');
    const next = { clientId: TRAKT_CLIENT_ID, accessToken: '', refreshToken: '', expiresAt: 0 };
    settingsRepository.saveTrakt(next);
    setTrakt(next);
    const authorizationUrl = await beginTraktAuthorization(TRAKT_CLIENT_ID);
    window.location.assign(authorizationUrl);
  }

  function disconnectTrakt() {
    settingsRepository.clearTrakt();
    setTrakt({ clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 });
  }

  function exportCollection() {
    downloadBackup(movies);
  }

  async function importCollection(file: File, mode: ImportMode): Promise<string> {
    const result = await importBackup(file, movies, mode);
    if (!persist(result.movies)) throw new Error('Import failed. Check the available storage on this device.');
    if (mode === 'replace') {
      return `${result.added} ${result.added === 1 ? 'movie' : 'movies'} imported (collection replaced).`;
    }
    const parts = [`${result.added} ${result.added === 1 ? 'movie' : 'movies'} added`];
    if (result.skipped) parts.push(`${result.skipped} skipped`);
    if (result.invalid) parts.push(`${result.invalid} invalid`);
    return `${parts.join(', ')}.`;
  }

  async function syncTraktMovies(): Promise<number> {
    const clientId = trakt.clientId || TRAKT_CLIENT_ID;
    if (!clientId || !trakt.accessToken) throw new Error('Sign in with Trakt first.');
    const effective = { ...trakt, clientId };
    let refreshed: TraktCredentials | null = null;
    const onCredentials = (updated: TraktCredentials) => {
      refreshed = updated;
      settingsRepository.saveTrakt(updated);
      setTrakt(updated);
    };
    const watched = await getWatchedMovies(effective, onCredentials);
    const watchlist = await getWatchlistMovies(refreshed || effective, onCredentials);

    const next = [...movies];
    let changed = 0;

    const findMatchIndex = (entry: TraktMovieRef) => {
      const tmdbId = entry.ids?.tmdb;
      return next.findIndex((movie) => (tmdbId && movie.tmdbId === tmdbId)
        || (movie.title.toLocaleLowerCase() === entry.title.toLocaleLowerCase() && movie.year === (entry.year ? String(entry.year) : undefined)));
    };

    const enrichFromTmdb = async (movie: Movie, tmdbId?: number): Promise<Movie> => {
      if (!tmdbId || (movie.posterPath && movie.releaseDate && movie.runtime && movie.genres?.length)) return movie;
      try {
        const details = await getMovieDetails(tmdbId, new AbortController().signal);
        let updated = movie;
        if (!updated.posterPath && details.poster_path) updated = { ...updated, posterPath: details.poster_path };
        if (!updated.runtime && details.runtime) updated = { ...updated, runtime: details.runtime };
        if (!updated.genres?.length && details.genres?.length) updated = { ...updated, genres: details.genres.map((g) => g.name) };
        if (!updated.releaseDate && details.release_date) updated = { ...updated, releaseDate: details.release_date };
        return updated;
      } catch {
        return movie;
      }
    };

    // 1) Watch history: always import/update as seen (seen wins).
    for (const item of watched) {
      const entry = item.movie;
      if (!entry?.title) continue;
      const tmdbId = entry.ids?.tmdb;
      const matchIndex = findMatchIndex(entry);
      const watchedAt = item.last_watched_at ? Date.parse(item.last_watched_at) || undefined : undefined;
      if (matchIndex >= 0) {
        const old = next[matchIndex];
        let updated = old.status === 'seen' ? old : { ...old, status: 'seen' as const };
        if (watchedAt) {
          if (!updated.watchedAt) updated = { ...updated, watchedAt };
          if (updated.addedAt !== watchedAt) updated = { ...updated, addedAt: watchedAt };
        }
        updated = await enrichFromTmdb(updated, tmdbId || updated.tmdbId);
        if (updated !== old) {
          next[matchIndex] = updated;
          changed += 1;
        }
        continue;
      }
      let created: Movie = {
        id: createId(),
        tmdbId,
        title: entry.title,
        year: entry.year ? String(entry.year) : undefined,
        status: 'seen',
        palette: Math.floor(Math.random() * 8),
        addedAt: watchedAt || Date.now(),
        watchedAt: watchedAt || Date.now(),
      };
      created = await enrichFromTmdb(created, tmdbId);
      next.push(created);
      changed += 1;
    }

    // 2) Watchlist: import as watchlist, but never downgrade a seen movie.
    for (const item of watchlist) {
      const entry = item.movie;
      if (!entry?.title) continue;
      const tmdbId = entry.ids?.tmdb;
      const listedAt = item.listed_at ? Date.parse(item.listed_at) || undefined : undefined;
      const matchIndex = findMatchIndex(entry);
      if (matchIndex >= 0) {
        const old = next[matchIndex];
        if (old.status === 'seen') continue;
        let updated = old;
        if (listedAt && updated.addedAt !== listedAt) updated = { ...updated, addedAt: listedAt };
        updated = await enrichFromTmdb(updated, tmdbId || updated.tmdbId);
        if (updated !== old) {
          next[matchIndex] = updated;
          changed += 1;
        }
        continue;
      }
      let created: Movie = {
        id: createId(),
        tmdbId,
        title: entry.title,
        year: entry.year ? String(entry.year) : undefined,
        status: 'watchlist',
        palette: Math.floor(Math.random() * 8),
        addedAt: listedAt || Date.now(),
      };
      created = await enrichFromTmdb(created, tmdbId);
      next.push(created);
      changed += 1;
    }

    if (changed && !persist(next)) throw new Error('Sync failed. Check the available storage on this device.');
    return changed;
  }

  return (
    <>
      <header className="desktop-appbar">
        <a className="desktop-brand" href="./" aria-label="Frame">frame<span>.</span></a>
        <button className="desktop-settings" type="button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </header>
      <header className="mobile-appbar">
        {mobileSearchOpen ? (
          <div
            className="mobile-search-inline"
            id="mobile-search"
            role="search"
            aria-label="Search"
            onKeyDown={(event) => { if (event.key === 'Escape') setMobileSearchOpen(false); }}
          >
            <SearchField
              value={activeTab === 'discover' ? discoverQuery : query}
              onChange={activeTab === 'discover' ? setDiscoverQuery : setQuery}
              label="Search movies"
              placeholder="Search by movie title…"
              autoFocus
            />
            <button
              className="mobile-search-close"
              type="button"
              aria-label="Close search"
              title="Close search"
              onClick={() => setMobileSearchOpen(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ) : (
          <>
            <a className="mobile-brand" href="./" aria-label="Frame — movie collection">frame<span aria-hidden="true">.</span></a>
            <div className="mobile-appbar-actions">
              <button
                className="mobile-search-toggle"
                type="button"
                aria-label="Search"
                aria-expanded={false}
                aria-controls="mobile-search"
                title="Search"
                onClick={() => { setMobileSearchOpen(true); setMobileFiltersOpen(false); }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              </button>
              {(activeTab === 'history' || activeTab === 'watchlist') && <button
                className={`mobile-filter-button${yearFilter !== 'all' || sortOrder !== 'newest' ? ' has-active' : ''}`}
                type="button"
                aria-label="Filters"
                aria-expanded={mobileFiltersOpen}
                aria-controls="mobile-filters"
                title="Filters"
                onClick={() => { setMobileFiltersOpen((open) => !open); setMobileSearchOpen(false); }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>
              </button>}
              <button className="mobile-settings" type="button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </>
        )}
      </header>
      <main className="app" hidden={!(activeTab === 'history' || activeTab === 'watchlist')}>
        <section className="collection" aria-label={isWatchlist ? 'Watchlist' : 'Seen'}>
          <div className="mobile-collection-heading">
            <div className="mobile-collection-title">
              <h1>{isWatchlist ? 'Watchlist' : 'Seen'}</h1>
              <span aria-label={`${collectionCount} ${collectionCount === 1 ? 'movie' : 'movies'}`}>{collectionCount}</span>
            </div>
            <ViewToggle className="mobile-view-toggle" />
          </div>
          <div className="toolbar">
            <SearchField value={query} onChange={setQuery} label="Search movies" placeholder="Search by movie title…" />
            <div className="collection-controls">
              <ViewToggle />
              <label className={`select-control${yearFilter !== 'all' ? ' active' : ''}`}>
                <span className="select-label-text">Year</span>
                <select aria-label="Filter by year" value={yearFilter} onChange={(event) => changeYearFilter(event.target.value)}>
                  <option value="all">All years</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className={`select-control${sortOrder !== 'newest' ? ' active' : ''}`}>
                <span className="select-label-text">Sort</span>
                <select aria-label="Sort movies" value={sortOrder} onChange={(event) => changeSortOrder(event.target.value as SortOrder)}>
                  <option value="newest">Newest added</option>
                  <option value="oldest">Oldest added</option>
                  <option value="title">Title A–Z</option>
                  <option value="year">Year: new to old</option>
                  <option value="rating">Highest rated</option>
                </select>
              </label>
            </div>
          </div>
          {storageError && <p className="storage-error" role="alert">{storageError}</p>}
          {traktNotice && <p className="trakt-message" role="status">{traktNotice}</p>}
          <MovieGrid
            view={collectionView}
            movies={visibleMovies}
            hasMovies={collectionCount > 0}
            searching={false}
            emptyMessage={query && !visibleMovies.length ? 'No search results' : !collectionCount ? (isWatchlist ? 'No movies on your watchlist yet' : 'No seen movies yet') : undefined}
            onAdd={openAddDialog}
            onDiscover={() => switchTab('discover')}
            onOpenSettings={() => setSettingsOpen(true)}
            onEdit={openEditDialog}
            onDelete={removeMovie}
            onOpen={openMovie}
          />
        </section>
      </main>
      {discoverMounted && <DiscoverPage
        hidden={activeTab !== 'discover'}
        collection={movies}
        query={discoverQuery}
        onQueryChange={setDiscoverQuery}
        onAdd={(movie, status) => Boolean(saveDiscoveredMovie(movie, status))}
        onOpen={openDiscoveredDetails}
      />}
      {activeTab === 'insights' && <InsightsPage movies={movies} onOpen={openMovie} />}
      {selectedMovie && <MovieDetailsPage
        movie={selectedMovie}
        discoveryPreview={Boolean(selectedDiscoveryMovie)}
        onSetStatus={(status) => setMovieStatusFromDetails(selectedMovie, status)}
        onSetRating={(rating) => setMovieRatingFromDetails(selectedMovie, rating)}
        onRemove={() => removeMovieFromDetails(selectedMovie.id)}
        onEdit={selectedDiscoveryMovie ? undefined : openEditDialog}
        onClose={closeDetails}
        onEnrich={enrichMovie}
      />}
      <AgendaPage open={agendaOpen} movies={movies} onClose={closeAgenda} onOpen={openMovieFromAgenda} />
      <dialog
        ref={filterDialogRef}
        className="movie-dialog mobile-filter-dialog"
        id="mobile-filters"
        aria-labelledby="mobile-filters-title"
        onCancel={(event) => { event.preventDefault(); setMobileFiltersOpen(false); }}
        onClose={() => setMobileFiltersOpen(false)}
        onClick={(event) => { if (event.target === filterDialogRef.current) setMobileFiltersOpen(false); }}
      >
        <form onSubmit={(event) => { event.preventDefault(); setMobileFiltersOpen(false); }}>
          <div className="dialog-head">
            <h2 id="mobile-filters-title">Filters</h2>
            <button type="button" className="close-button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)}>×</button>
          </div>
          <label className="form-field">Year
            <select aria-label="Filter by year" value={yearFilter} onChange={(event) => changeYearFilter(event.target.value)}>
              <option value="all">All years</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="form-field">Sort
            <select aria-label="Sort movies" value={sortOrder} onChange={(event) => changeSortOrder(event.target.value as SortOrder)}>
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="title">Title A–Z</option>
              <option value="year">Year: new to old</option>
              <option value="rating">Highest rated</option>
            </select>
          </label>
          <button className="save-button" type="submit">Done</button>
          <button className="remove-token" type="button" onClick={resetFilters}>Clear filters</button>
        </form>
      </dialog>
      <div className="mobile-bottom-actions">
      <div className="bottom-bar-side left">
        <button className="mobile-add-button agenda-button" type="button" aria-label="Agenda" title="Agenda" onClick={openAgenda}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
        </button>
      </div>
      <nav className="mobile-bottom-tabs" aria-label="Hoofdnavigatie">
        <button type="button" className={activeTab === 'history' ? 'active' : ''} aria-label="Seen" aria-current={activeTab === 'history' ? 'page' : undefined} onClick={() => switchTab('history')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9v11h13V9" /><path d="M10 20v-5h4v5" /></svg>
          <span className="tab-label">Seen</span>
        </button>
        <button type="button" className={activeTab === 'watchlist' ? 'active' : ''} aria-label="Watchlist" aria-current={activeTab === 'watchlist' ? 'page' : undefined} onClick={() => switchTab('watchlist')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" /></svg>
          <span className="tab-label">Watchlist</span>
        </button>
        <button type="button" className={activeTab === 'discover' ? 'active' : ''} aria-label="Discover" aria-current={activeTab === 'discover' ? 'page' : undefined} onClick={() => switchTab('discover')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" /></svg>
          <span className="tab-label">Discover</span>
        </button>
        <button type="button" className={activeTab === 'insights' ? 'active' : ''} aria-label="Insights" aria-current={activeTab === 'insights' ? 'page' : undefined} onClick={() => switchTab('insights')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5" /><path d="M8 19v-6" /><path d="M12 19V9" /><path d="M16 19V7" /><path d="M20 19v-9" /></svg>
          <span className="tab-label">Insights</span>
        </button>
      </nav>
      <div className="bottom-bar-side">
        <button className="mobile-add-button" type="button" aria-label="Add movie" title="Add movie" onClick={openAddDialog}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      </div>
      <p className="tmdb-credit">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <MovieDialog open={movieDialogOpen} movie={editingMovie} onClose={closeMovieDialog} onSave={handleSave} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}
        trakt={trakt} onConnectTrakt={connectTrakt} onDisconnectTrakt={disconnectTrakt} onSyncTrakt={syncTraktMovies}
        onExport={exportCollection} onImport={importCollection} />
    </>
  );
}
