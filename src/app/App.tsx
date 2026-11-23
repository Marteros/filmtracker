import { useModalScrollLock } from '@/hooks/useModalScrollLock';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MovieDialog } from '@/features/collection/MovieDialog';
import { MovieGrid } from '@/features/collection/MovieGrid';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { MovieDetailsPage } from '@/features/details/MovieDetailsPage';
import { DiscoverPage } from '@/features/discover/DiscoverPage';
import { SearchField } from '@/components/ui/SearchField';
import { ViewToggle } from '@/features/collection/ViewToggle';
import { InsightsPage } from '@/features/insights/InsightsPage';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { useCollection } from './useCollection';
import { migrateSettings, getTraktSettings, saveTraktSettings, clearTraktSettings } from '@/services/settingsStore';
import { parseDateOnly } from '@/lib/dates';
import { findMovie } from '@/lib/movie';
import {
  beginTraktAuthorization,
  finishTraktAuthorization,
  getWatchedMovies,
  getWatchlistMovies,
  TRAKT_CLIENT_ID,
  type TraktCredentials,
  type TraktMovieRef,
} from '@/services/trakt';
import { getMovieDetails, TmdbError } from '@/services/tmdb';
import { downloadBackup, importBackup, type ImportMode } from '@/services/backup';
import { applyTheme, getStoredThemeMode, saveThemeMode, type ThemeMode } from '@/services/theme';
import type { Movie, MovieDraft, TmdbMovie } from '@/types';

type SortOrder = 'newest' | 'oldest' | 'title' | 'year' | 'rating';
type AppTab = 'history' | 'watchlist' | 'discover' | 'insights';
type CollectionView = 'grid' | 'list';
const COLLECTION_VIEW_KEY = 'frame-collection-view-v1';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const collection = useCollection();
  const movies = collection.movies;
  const storageError = collection.storageError;
  const [trakt, setTrakt] = useState<TraktCredentials>(() => getTraktSettings());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [discoverMounted, setDiscoverMounted] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [yearFilter, setYearFilter] = useState('all');
  const [collectionView, setCollectionView] = useState<CollectionView>(() => {
    try {
      return localStorage.getItem(COLLECTION_VIEW_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [query, setQuery] = useState('');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  useModalScrollLock(mobileFiltersOpen);
  const [movieDialogOpen, setMovieDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie>();
  const [selectedMovie, setSelectedMovie] = useState<Movie>();
  const [selectedDiscoveryMovie, setSelectedDiscoveryMovie] = useState<TmdbMovie>();
  const [traktNotice, setTraktNotice] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const traktCallbackHandled = useRef(false);
  const sharedMovieHandled = useRef(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const detailsHistoryRef = useRef(false);
  const agendaHistoryRef = useRef(false);
  const settingsHistoryRef = useRef(false);
  const movieDialogHistoryRef = useRef(false);
  const filtersHistoryRef = useRef(false);

  useEffect(() => {
    migrateSettings();
  }, []);

  useEffect(() => {
    applyTheme(themeMode);
    if (themeMode !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    if (media.addEventListener) media.addEventListener('change', onChange);
    else media.addListener(onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
    };
  }, [themeMode]);

  function changeThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    saveThemeMode(mode);
  }

  useEffect(() => {
    if (sharedMovieHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || params.has('error')) return;
    const raw = params.get('movie');
    if (!raw) return;
    const tmdbId = Number(raw);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      return;
    }
    sharedMovieHandled.current = true;

    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    void (async () => {
      let movie: Awaited<ReturnType<typeof getMovieDetails>> | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          movie = await getMovieDetails(tmdbId, new AbortController().signal);
          break;
        } catch (error) {
          const network = error instanceof TmdbError && error.kind === 'network';
          if (network && attempt === 0) {
            await wait(500);
            continue;
          }
          setShareNotice(
            network
              ? 'Could not open the shared movie. Check your connection and try again.'
              : 'Could not open the shared movie.',
          );
          return;
        }
      }
      if (!movie) return;
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      setShareNotice('');
      window.history.replaceState({ ...(window.history.state || {}) }, '');
      openDiscoveredDetails(movie);
    })();
  }, []);

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
        saveTraktSettings(credentials);
        setTrakt(credentials);
        setTraktNotice('Trakt is connected. You can now sync your watch history and watchlist.');
      })
      .catch((reason: unknown) => {
        setTraktNotice(reason instanceof Error ? reason.message : 'Could not connect Trakt.');
      });
  }, [trakt.clientId]);

  useEffect(() => {
    if (mobileFiltersOpen) {
      if (filtersHistoryRef.current && window.history.state?.frameFilters) window.history.back();
      else {
        filtersHistoryRef.current = false;
        setMobileFiltersOpen(false);
      }
    }
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
    const timer = window.setTimeout(() => {
      armed = true;
    }, 300);
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
    function restoreDetailsFromState(state: any) {
      const details = state?.frameDetails;
      if (!details) return false;
      if (details.discovery && typeof details.discovery === 'object') {
        const movie = details.discovery as TmdbMovie;
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
        return true;
      }
      if (typeof details.movieId === 'string') {
        const saved = collection.findById(details.movieId);
        if (saved) {
          setSelectedDiscoveryMovie(undefined);
          setSelectedMovie(saved);
          return true;
        }
      }
      return false;
    }

    function onPopState(event: PopStateEvent) {
      const state = event.state || {};

      // Details
      if (state.frameDetails) {
        detailsHistoryRef.current = true;
        agendaHistoryRef.current = false;
        if (!restoreDetailsFromState(state)) {
          detailsHistoryRef.current = false;
          setSelectedMovie(undefined);
          setSelectedDiscoveryMovie(undefined);
        }
      } else if (detailsHistoryRef.current || selectedMovie) {
        detailsHistoryRef.current = false;
        setSelectedMovie(undefined);
        setSelectedDiscoveryMovie(undefined);
      }

      // Agenda (only when details not active)
      if (state.frameAgenda && !state.frameDetails) {
        agendaHistoryRef.current = true;
        setAgendaOpen(true);
      } else if (agendaHistoryRef.current || agendaOpen) {
        agendaHistoryRef.current = false;
        setAgendaOpen(false);
      }

      // Settings dialog
      if (state.frameSettings) {
        settingsHistoryRef.current = true;
        setSettingsOpen(true);
      } else if (settingsHistoryRef.current || settingsOpen) {
        settingsHistoryRef.current = false;
        setSettingsOpen(false);
      }

      // Movie dialog
      if (state.frameMovieDialog) {
        movieDialogHistoryRef.current = true;
        // Cannot reliably restore which movie was being edited; close to avoid inconsistent state.
        if (!movieDialogOpen) setMovieDialogOpen(false);
      } else if (movieDialogHistoryRef.current || movieDialogOpen) {
        movieDialogHistoryRef.current = false;
        setMovieDialogOpen(false);
        setEditingMovie(undefined);
      }

      // Mobile filters dialog
      if (state.frameFilters) {
        filtersHistoryRef.current = true;
        setMobileFiltersOpen(true);
      } else if (filtersHistoryRef.current || mobileFiltersOpen) {
        filtersHistoryRef.current = false;
        setMobileFiltersOpen(false);
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [agendaOpen, movieDialogOpen, mobileFiltersOpen, selectedMovie, settingsOpen]);

  const isWatchlist = activeTab === 'watchlist';
  const statusMovies = useMemo(
    () => movies.filter((movie) => movie.status === (isWatchlist ? 'watchlist' : 'seen')),
    [isWatchlist, movies],
  );

  const visibleMovies = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return statusMovies
      .filter((movie) => {
        const matchesQuery =
          !search || `${movie.title} ${movie.year || ''} ${movie.note || ''}`.toLocaleLowerCase().includes(search);
        const matchesYear = yearFilter === 'all' || movie.year === yearFilter;
        return matchesQuery && matchesYear;
      })
      .sort((a, b) => {
        if (sortOrder === 'oldest') return a.addedAt - b.addedAt;
        if (sortOrder === 'title') return a.title.localeCompare(b.title);
        if (sortOrder === 'year')
          return (Number(b.year) || 0) - (Number(a.year) || 0) || a.title.localeCompare(b.title);
        if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0) || b.addedAt - a.addedAt;
        return b.addedAt - a.addedAt;
      });
  }, [query, sortOrder, statusMovies, yearFilter]);

  const collectionCount = statusMovies.length;

  const years = useMemo(
    () =>
      [...new Set(movies.map((movie) => movie.year).filter((year): year is string => Boolean(year)))].sort(
        (a, b) => Number(b) - Number(a),
      ),
    [movies],
  );
  function handleSave(draft: MovieDraft): string | null {
    const duplicate = movies.find((movie) => {
      if (movie.id === editingMovie?.id) return false;
      return (
        (draft.tmdbId && movie.tmdbId === draft.tmdbId) ||
        movie.title.toLocaleLowerCase() === draft.title.toLocaleLowerCase()
      );
    });
    if (duplicate) return `“${duplicate.title}” is already in your collection. You can edit that movie.`;

    const old = editingMovie;
    const watchedAt =
      draft.status === 'seen' ? (parseDateOnly(draft.watchedAt) ?? old?.watchedAt ?? Date.now()) : undefined;
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
    const saved = old ? collection.updateMovie(old.id, nextMovie) : collection.addMovie(nextMovie);
    if (!saved) return 'Could not save. Check the available storage on this device.';
    if (old && selectedMovie?.id === old.id) setSelectedMovie(nextMovie);
    closeMovieDialog();
    return null;
  }

  function openAddDialog() {
    setMobileFiltersOpen(false);
    setMobileSearchOpen(false);
    setEditingMovie(undefined);
    if (movieDialogOpen) return;
    setMovieDialogOpen(true);
    if (!movieDialogHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameMovieDialog: true }, '');
      movieDialogHistoryRef.current = true;
    }
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
    if (agendaHistoryRef.current && window.history.state?.frameAgenda) {
      window.history.back();
      return;
    }
    agendaHistoryRef.current = false;
    setAgendaOpen(false);
  }

  function openMovie(movie: Movie) {
    setSelectedDiscoveryMovie(undefined);
    setSelectedMovie(movie);
    if (!detailsHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameDetails: { movieId: movie.id } }, '');
      detailsHistoryRef.current = true;
    } else {
      window.history.replaceState({ ...(window.history.state || {}), frameDetails: { movieId: movie.id } }, '');
    }
  }

  function openMovieFromAgenda(movie: Movie) {
    // Keep agenda mounted under the details overlay so browser back returns to it.
    setSelectedDiscoveryMovie(undefined);
    setSelectedMovie(movie);
    if (!detailsHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameDetails: { movieId: movie.id } }, '');
      detailsHistoryRef.current = true;
    } else {
      window.history.replaceState({ ...(window.history.state || {}), frameDetails: { movieId: movie.id } }, '');
    }
  }

  function closeDetails() {
    if (detailsHistoryRef.current && window.history.state?.frameDetails) {
      window.history.back();
      return;
    }
    detailsHistoryRef.current = false;
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
    try {
      localStorage.setItem(COLLECTION_VIEW_KEY, view);
    } catch {
      /* Keep the view preference local. */
    }
  }

  function findSavedMovie(movie: TmdbMovie) {
    const year = movie.release_date?.slice(0, 4);
    return findMovie(movies, { tmdbId: movie.id, title: movie.title, year });
  }

  function saveDiscoveredMovie(movie: TmdbMovie, status: 'seen' | 'watchlist' = 'watchlist'): Movie | undefined {
    const existing = findSavedMovie(movie);
    if (existing) {
      if (status === 'seen' && existing.status === 'watchlist') {
        const updated: Movie = { ...existing, status: 'seen', watchedAt: existing.watchedAt ?? Date.now() };
        return collection.updateMovie(existing.id, updated) ? updated : undefined;
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
    return collection.addMovie(saved) ? saved : undefined;
  }

  function openDiscoveredDetails(movie: TmdbMovie) {
    const saved = findSavedMovie(movie);
    const detailsState = saved ? { movieId: saved.id } : { discovery: movie };
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
      window.history.pushState({ ...(window.history.state || {}), frameDetails: detailsState }, '');
      detailsHistoryRef.current = true;
    } else {
      window.history.replaceState({ ...(window.history.state || {}), frameDetails: detailsState }, '');
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
    if (!collection.updateMovie(movie.id, nextMovie)) return false;
    setSelectedMovie(nextMovie);
    return true;
  }

  function setMovieRatingFromDetails(movie: Movie, rating?: Movie['rating']) {
    if (movie.status !== 'seen') return;
    const nextMovie: Movie = { ...movie, rating };
    if (collection.updateMovie(movie.id, nextMovie)) setSelectedMovie(nextMovie);
  }

  function removeMovieFromDetails(id: string): boolean {
    if (!collection.findById(id)) return false;
    return collection.removeMovie(id);
  }

  function openEditDialog(movie: Movie) {
    setEditingMovie(movie);
    if (movieDialogOpen) return;
    setMovieDialogOpen(true);
    if (!movieDialogHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), frameMovieDialog: true }, '');
      movieDialogHistoryRef.current = true;
    }
  }

  function closeMovieDialog() {
    if (movieDialogHistoryRef.current && window.history.state?.frameMovieDialog) {
      window.history.back();
      return;
    }
    movieDialogHistoryRef.current = false;
    setMovieDialogOpen(false);
    setEditingMovie(undefined);
  }

  function removeMovie(id: string): boolean {
    const movie = movies.find((item) => item.id === id);
    if (!movie || !window.confirm(`Remove “${movie.title}” from your collection?`)) return false;
    return collection.removeMovie(id);
  }

  const enrichMovie = useCallback(
    (id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>) => {
      collection.enrichMovie(id, patch);
      setSelectedMovie((current) => (current && current.id === id ? { ...current, ...patch } : current));
    },
    [collection],
  );

  async function connectTrakt() {
    if (!TRAKT_CLIENT_ID) throw new Error('Trakt is not configured yet. Add a Trakt Client ID in the app code.');
    const next = { clientId: TRAKT_CLIENT_ID, accessToken: '', refreshToken: '', expiresAt: 0 };
    saveTraktSettings(next);
    setTrakt(next);
    const authorizationUrl = await beginTraktAuthorization(TRAKT_CLIENT_ID);
    window.location.assign(authorizationUrl);
  }

  function disconnectTrakt() {
    clearTraktSettings();
    setTrakt({ clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 });
  }

  function exportCollection() {
    downloadBackup(movies);
  }

  async function importCollection(file: File, mode: ImportMode): Promise<string> {
    const result = await importBackup(file, movies, mode);
    if (!collection.replaceAll(result.movies))
      throw new Error('Import failed. Check the available storage on this device.');
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
      saveTraktSettings(updated);
      setTrakt(updated);
    };
    const watched = await getWatchedMovies(effective, onCredentials);
    const watchlist = await getWatchlistMovies(refreshed || effective, onCredentials);

    const next = [...movies];
    let changed = 0;

    const findMatchIndex = (entry: TraktMovieRef) => {
      const tmdbId = entry.ids?.tmdb;
      return next.findIndex(
        (movie) =>
          (tmdbId && movie.tmdbId === tmdbId) ||
          (movie.title.toLocaleLowerCase() === entry.title.toLocaleLowerCase() &&
            movie.year === (entry.year ? String(entry.year) : undefined)),
      );
    };

    const enrichFromTmdb = async (movie: Movie, tmdbId?: number): Promise<Movie> => {
      if (!tmdbId || (movie.posterPath && movie.releaseDate && movie.runtime && movie.genres?.length)) return movie;
      try {
        const details = await getMovieDetails(tmdbId, new AbortController().signal);
        let updated = movie;
        if (!updated.posterPath && details.poster_path) updated = { ...updated, posterPath: details.poster_path };
        if (!updated.runtime && details.runtime) updated = { ...updated, runtime: details.runtime };
        if (!updated.genres?.length && details.genres?.length)
          updated = { ...updated, genres: details.genres.map((g) => g.name) };
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
        if (watchedAt && !updated.watchedAt) {
          updated = { ...updated, watchedAt };
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

    if (changed && !collection.replaceAll(next))
      throw new Error('Sync failed. Check the available storage on this device.');
    return changed;
  }

  return (
    <>
      <header className="desktop-appbar">
        <a className="desktop-brand" href="./" aria-label="Frame">
          frame<span>.</span>
        </a>
        <button
          className="desktop-settings"
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={() => {
            if (!settingsOpen) {
              setSettingsOpen(true);
              if (!settingsHistoryRef.current) {
                window.history.pushState({ ...(window.history.state || {}), frameSettings: true }, '');
                settingsHistoryRef.current = true;
              }
            }
          }}
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
              if (event.key === 'Escape') setMobileSearchOpen(false);
            }}
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
                onClick={() => {
                  setMobileSearchOpen(true);
                  setMobileFiltersOpen(false);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </button>
              {(activeTab === 'history' || activeTab === 'watchlist') && (
                <button
                  className={`mobile-filter-button${yearFilter !== 'all' || sortOrder !== 'newest' ? ' has-active' : ''}`}
                  type="button"
                  aria-label="Filters"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="mobile-filters"
                  title="Filters"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    if (mobileFiltersOpen) {
                      if (filtersHistoryRef.current && window.history.state?.frameFilters) {
                        window.history.back();
                        return;
                      }
                      filtersHistoryRef.current = false;
                      setMobileFiltersOpen(false);
                    } else {
                      setMobileFiltersOpen(true);
                      if (!filtersHistoryRef.current) {
                        window.history.pushState({ ...(window.history.state || {}), frameFilters: true }, '');
                        filtersHistoryRef.current = true;
                      }
                    }
                  }}
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
                onClick={() => {
                  setSettingsOpen(true);
                  if (!settingsHistoryRef.current) {
                    window.history.pushState({ ...(window.history.state || {}), frameSettings: true }, '');
                    settingsHistoryRef.current = true;
                  }
                }}
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
      <main className="app" hidden={!(activeTab === 'history' || activeTab === 'watchlist')}>
        <section className="collection" aria-label={isWatchlist ? 'Watchlist' : 'Seen'}>
          <div className="mobile-collection-heading">
            <div className="mobile-collection-title">
              <h1>{isWatchlist ? 'Watchlist' : 'Seen'}</h1>
              <span aria-label={`${collectionCount} ${collectionCount === 1 ? 'movie' : 'movies'}`}>
                {collectionCount}
              </span>
            </div>
            <ViewToggle view={collectionView} onChange={changeCollectionView} className="mobile-view-toggle" />
          </div>
          <div className="toolbar">
            <SearchField value={query} onChange={setQuery} label="Search movies" placeholder="Search by movie title…" />
            <div className="collection-controls">
              <ViewToggle view={collectionView} onChange={changeCollectionView} />
              <label className={`select-control${yearFilter !== 'all' ? ' active' : ''}`}>
                <span className="select-label-text">Year</span>
                <select
                  aria-label="Filter by year"
                  value={yearFilter}
                  onChange={(event) => changeYearFilter(event.target.value)}
                >
                  <option value="all">All years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`select-control${sortOrder !== 'newest' ? ' active' : ''}`}>
                <span className="select-label-text">Sort</span>
                <select
                  aria-label="Sort movies"
                  value={sortOrder}
                  onChange={(event) => changeSortOrder(event.target.value as SortOrder)}
                >
                  <option value="newest">Newest added</option>
                  <option value="oldest">Oldest added</option>
                  <option value="title">Title A–Z</option>
                  <option value="year">Year: new to old</option>
                  <option value="rating">Highest rated</option>
                </select>
              </label>
            </div>
          </div>
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
          <MovieGrid
            view={collectionView}
            movies={visibleMovies}
            collectionHasMovies={movies.length > 0}
            emptyMessage={
              query && !visibleMovies.length
                ? 'No search results'
                : !collectionCount && yearFilter !== 'all'
                  ? 'No movies match your filters'
                  : !collectionCount
                    ? isWatchlist
                      ? 'No movies on your watchlist yet'
                      : 'No seen movies yet'
                    : undefined
            }
            onAdd={openAddDialog}
            onDiscover={() => switchTab('discover')}
            onOpenSettings={() => {
              if (!settingsOpen) {
                setSettingsOpen(true);
                if (!settingsHistoryRef.current) {
                  window.history.pushState({ ...(window.history.state || {}), frameSettings: true }, '');
                  settingsHistoryRef.current = true;
                }
              }
            }}
            onEdit={openEditDialog}
            onDelete={removeMovie}
            onOpen={openMovie}
          />
        </section>
      </main>
      {discoverMounted && (
        <DiscoverPage
          hidden={activeTab !== 'discover'}
          collection={movies}
          query={discoverQuery}
          onQueryChange={setDiscoverQuery}
          onAdd={(movie, status) => Boolean(saveDiscoveredMovie(movie, status))}
          onOpen={openDiscoveredDetails}
        />
      )}
      {activeTab === 'insights' && <InsightsPage movies={movies} onOpen={openMovie} />}
      {selectedMovie && (
        <MovieDetailsPage
          movie={selectedMovie}
          discoveryPreview={Boolean(selectedDiscoveryMovie)}
          onSetStatus={(status) => setMovieStatusFromDetails(selectedMovie, status)}
          onSetRating={(rating) => setMovieRatingFromDetails(selectedMovie, rating)}
          onRemove={() => removeMovieFromDetails(selectedMovie.id)}
          onEdit={selectedDiscoveryMovie ? undefined : openEditDialog}
          onClose={closeDetails}
          onEnrich={enrichMovie}
        />
      )}
      <AgendaPage open={agendaOpen} movies={movies} onClose={closeAgenda} onOpen={openMovieFromAgenda} />
      <dialog
        ref={filterDialogRef}
        className="movie-dialog mobile-filter-dialog"
        id="mobile-filters"
        aria-labelledby="mobile-filters-title"
        onCancel={(event) => {
          event.preventDefault();
          if (filtersHistoryRef.current && window.history.state?.frameFilters) {
            window.history.back();
            return;
          }
          filtersHistoryRef.current = false;
          setMobileFiltersOpen(false);
        }}
        onClose={() => {
          filtersHistoryRef.current = false;
          setMobileFiltersOpen(false);
        }}
        onClick={(event) => {
          if (event.target === filterDialogRef.current) {
            if (filtersHistoryRef.current && window.history.state?.frameFilters) {
              window.history.back();
              return;
            }
            filtersHistoryRef.current = false;
            setMobileFiltersOpen(false);
          }
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (filtersHistoryRef.current && window.history.state?.frameFilters) {
              window.history.back();
              return;
            }
            filtersHistoryRef.current = false;
            setMobileFiltersOpen(false);
          }}
        >
          <div className="dialog-head">
            <h2 id="mobile-filters-title">Filters</h2>
            <button
              type="button"
              className="close-button"
              aria-label="Close filters"
              onClick={() => {
                if (filtersHistoryRef.current && window.history.state?.frameFilters) {
                  window.history.back();
                  return;
                }
                filtersHistoryRef.current = false;
                setMobileFiltersOpen(false);
              }}
            >
              ×
            </button>
          </div>
          <label className="form-field">
            Year
            <select
              aria-label="Filter by year"
              value={yearFilter}
              onChange={(event) => changeYearFilter(event.target.value)}
            >
              <option value="all">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Sort
            <select
              aria-label="Sort movies"
              value={sortOrder}
              onChange={(event) => changeSortOrder(event.target.value as SortOrder)}
            >
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="title">Title A–Z</option>
              <option value="year">Year: new to old</option>
              <option value="rating">Highest rated</option>
            </select>
          </label>
          <button className="save-button" type="submit">
            Done
          </button>
          <button className="remove-token" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        </form>
      </dialog>
      <div className="mobile-bottom-actions">
        <div className="bottom-bar-side left">
          <button
            className="mobile-add-button agenda-button"
            type="button"
            aria-label="Agenda"
            title="Agenda"
            onClick={openAgenda}
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
            onClick={() => switchTab('history')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5.5 9v11h13V9" />
              <path d="M10 20v-5h4v5" />
            </svg>
            <span className="tab-label">Seen</span>
          </button>
          <button
            type="button"
            className={activeTab === 'watchlist' ? 'active' : ''}
            aria-label="Watchlist"
            aria-current={activeTab === 'watchlist' ? 'page' : undefined}
            onClick={() => switchTab('watchlist')}
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
            onClick={() => switchTab('discover')}
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
            onClick={() => switchTab('insights')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19V5" />
              <path d="M8 19v-6" />
              <path d="M12 19V9" />
              <path d="M16 19V7" />
              <path d="M20 19v-9" />
            </svg>
            <span className="tab-label">Insights</span>
          </button>
        </nav>
        <div className="bottom-bar-side">
          <button
            className="mobile-add-button"
            type="button"
            aria-label="Add movie"
            title="Add movie"
            onClick={openAddDialog}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
      <p className="tmdb-credit">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <MovieDialog open={movieDialogOpen} movie={editingMovie} onClose={closeMovieDialog} onSave={handleSave} />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          if (settingsHistoryRef.current && window.history.state?.frameSettings) {
            window.history.back();
            return;
          }
          settingsHistoryRef.current = false;
          setSettingsOpen(false);
        }}
        trakt={trakt}
        onConnectTrakt={connectTrakt}
        onDisconnectTrakt={disconnectTrakt}
        onSyncTrakt={syncTraktMovies}
        themeMode={themeMode}
        onThemeModeChange={changeThemeMode}
        onExport={exportCollection}
        onImport={importCollection}
      />
    </>
  );
}
