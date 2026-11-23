import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppShell } from './AppShell';
import { useAppNavigation } from './useAppNavigation';
import { useCollection } from './useCollection';
import { CollectionPage } from '@/features/collection/CollectionPage';
import { FilterDialog } from '@/features/collection/FilterDialog';
import { MovieDialog } from '@/features/collection/MovieDialog';
import { useCollectionFilters, type SortOrder } from '@/features/collection/useCollectionFilters';
import { MovieDetailsPage } from '@/features/details/MovieDetailsPage';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { SettingsDialog } from '@/features/settings/SettingsDialog';

const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const InsightsPage = lazy(() => import('@/features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })));
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { readOverlay } from '@/lib/overlayState';
import { parseDateOnly } from '@/lib/dates';
import { findMovie } from '@/lib/movie';
import { downloadBackup, importBackup, type ImportMode } from '@/services/backup';
import { applyTheme, getStoredThemeMode, saveThemeMode, type ThemeMode } from '@/services/theme';
import { clearTraktSettings, getTraktSettings, migrateSettings, saveTraktSettings } from '@/services/settingsStore';
import {
  beginTraktAuthorization,
  finishTraktAuthorization,
  getWatchedMovies,
  getWatchlistMovies,
  TRAKT_CLIENT_ID,
  type TraktCredentials,
} from '@/services/trakt';
import { buildSyncedCollection } from '@/services/traktSync';
import { getMovieDetails, TmdbError } from '@/services/tmdb';
import { getMovieDetailsCached } from '@/lib/tmdbCache';
import type { Movie, MovieDraft, TmdbMovie } from '@/types';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type DetailsPayload = { movieId?: string; discovery?: TmdbMovie };

export default function App() {
  const collection = useCollection();
  const { movies, storageError } = collection;
  const nav = useAppNavigation();
  const isWatchlist = nav.activeTab === 'watchlist';
  const filters = useCollectionFilters(movies, isWatchlist);

  const [trakt, setTrakt] = useState<TraktCredentials>(() => getTraktSettings());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [discoverQuery, setDiscoverQuery] = useState('');
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

  const settingsOverlay = useHistoryOverlay<boolean>({
    key: 'frameSettings',
    onChange: (value) => setSettingsOpen(Boolean(value)),
  });
  const agendaOverlay = useHistoryOverlay<boolean>({
    key: 'frameAgenda',
    onChange: (value) => setAgendaOpen(Boolean(value)),
  });
  const filtersOverlay = useHistoryOverlay<boolean>({
    key: 'frameFilters',
    onChange: (value) => filters.setMobileFiltersOpen(Boolean(value)),
  });
  const movieDialogOverlay = useHistoryOverlay<boolean>({
    key: 'frameMovieDialog',
    onChange: (value) => {
      setMovieDialogOpen(Boolean(value));
      if (!value) setEditingMovie(undefined);
    },
  });
  const detailsOverlay = useHistoryOverlay<DetailsPayload>({
    key: 'frameDetails',
    onChange: (payload) => {
      if (!payload) {
        setSelectedMovie(undefined);
        setSelectedDiscoveryMovie(undefined);
        return;
      }
      if (payload.discovery) {
        setSelectedDiscoveryMovie(payload.discovery);
        setSelectedMovie({
          id: `discover-${payload.discovery.id}`,
          tmdbId: payload.discovery.id,
          title: payload.discovery.title,
          year: payload.discovery.release_date?.slice(0, 4),
          releaseDate: payload.discovery.release_date || undefined,
          status: 'watchlist',
          posterPath: payload.discovery.poster_path || undefined,
          palette: 0,
          addedAt: Date.now(),
        });
        return;
      }
      if (payload.movieId) {
        const saved = collection.findById(payload.movieId);
        if (saved) {
          setSelectedDiscoveryMovie(undefined);
          setSelectedMovie(saved);
          return;
        }
      }
      setSelectedMovie(undefined);
      setSelectedDiscoveryMovie(undefined);
    },
  });

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Restore overlays from an existing history entry (forward navigation / reload with state).
  useEffect(() => {
    const state = window.history.state;
    if (readOverlay(state, 'frameSettings')) setSettingsOpen(true);
    if (readOverlay(state, 'frameAgenda')) setAgendaOpen(true);
    if (readOverlay(state, 'frameFilters')) filters.setMobileFiltersOpen(true);
    const details = readOverlay(state, 'frameDetails') as DetailsPayload | undefined;
    if (details?.discovery) {
      setSelectedDiscoveryMovie(details.discovery);
      setSelectedMovie({
        id: `discover-${details.discovery.id}`,
        tmdbId: details.discovery.id,
        title: details.discovery.title,
        year: details.discovery.release_date?.slice(0, 4),
        releaseDate: details.discovery.release_date || undefined,
        status: 'watchlist',
        posterPath: details.discovery.poster_path || undefined,
        palette: 0,
        addedAt: Date.now(),
      });
    } else if (details?.movieId) {
      const saved = collection.findById(details.movieId);
      if (saved) {
        setSelectedDiscoveryMovie(undefined);
        setSelectedMovie(saved);
      }
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      openDiscoveredDetails(movie);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    filters.closeMobilePanels();
  }, [nav.activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filters.mobileSearchOpen) return;
    let armed = false;
    const timer = window.setTimeout(() => {
      armed = true;
    }, 300);
    function closeOnScroll() {
      if (!armed) return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      filters.setMobileSearchOpen(false);
    }
    window.addEventListener('scroll', closeOnScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', closeOnScroll);
    };
  }, [filters.mobileSearchOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function openSettings() {
    if (settingsOpen) return;
    setSettingsOpen(true);
    settingsOverlay.open(true);
  }
  function closeSettings() {
    settingsOverlay.close();
  }
  function openAgenda() {
    if (agendaOpen) return;
    setAgendaOpen(true);
    agendaOverlay.open(true);
  }
  function closeAgenda() {
    agendaOverlay.close();
  }
  function openFilters() {
    if (filters.mobileFiltersOpen) return;
    filters.setMobileSearchOpen(false);
    filters.setMobileFiltersOpen(true);
    filtersOverlay.open(true);
  }
  function closeFilters() {
    filtersOverlay.close();
  }
  function openMovieDialog(movie?: Movie) {
    setEditingMovie(movie);
    if (movieDialogOpen) return;
    setMovieDialogOpen(true);
    movieDialogOverlay.open(true);
  }
  function closeMovieDialog() {
    movieDialogOverlay.close();
  }

  function openMovie(movie: Movie) {
    setSelectedDiscoveryMovie(undefined);
    setSelectedMovie(movie);
    detailsOverlay.open({ movieId: movie.id });
  }
  function openDiscoveredDetails(movie: TmdbMovie) {
    const saved = findSavedMovie(movie);
    if (saved) {
      setSelectedDiscoveryMovie(undefined);
      setSelectedMovie(saved);
      detailsOverlay.open({ movieId: saved.id });
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
      detailsOverlay.open({ discovery: movie });
    }
  }
  function openMovieFromAgenda(movie: Movie) {
    setSelectedDiscoveryMovie(undefined);
    setSelectedMovie(movie);
    detailsOverlay.open({ movieId: movie.id });
  }
  function closeDetails() {
    detailsOverlay.close();
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

  function removeMovie(id: string): boolean {
    const movie = collection.findById(id);
    if (!movie || !window.confirm(`Remove “${movie.title}” from your collection?`)) return false;
    return collection.removeMovie(id);
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
    const ok = mode === 'replace' ? collection.replaceAll(result.movies) : collection.mergeMany(result.movies);
    if (!ok) throw new Error('Import failed. Check the available storage on this device.');
    if (mode === 'replace')
      return `${result.added} ${result.added === 1 ? 'movie' : 'movies'} imported (collection replaced).`;
    const parts = [`${result.added} ${result.added === 1 ? 'movie' : 'movies'} added`];
    if (result.skipped) parts.push(`${result.skipped} skipped`);
    if (result.invalid) parts.push(`${result.invalid} invalid`);
    return `${parts.join(', ')}.`;
  }

  async function syncTraktMovies(onProgress?: (done: number, total: number) => void): Promise<number> {
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
    const result = await buildSyncedCollection(
      { watched, watchlist, current: movies },
      { getDetails: getMovieDetailsCached, limit: 4, onProgress },
    );
    if (result.changed && !collection.replaceAll(result.movies)) {
      throw new Error('Sync failed. Check the available storage on this device.');
    }
    return result.changed;
  }

  const mobileSearchValue = nav.activeTab === 'discover' ? discoverQuery : filters.query;
  const setMobileSearchValue = nav.activeTab === 'discover' ? setDiscoverQuery : filters.setQuery;

  return (
    <AppShell
      activeTab={nav.activeTab}
      onSwitchTab={(tab) => {
        filters.closeMobilePanels();
        nav.switchTab(tab);
      }}
      onOpenSettings={openSettings}
      onOpenAgenda={openAgenda}
      onAdd={() => openMovieDialog()}
      mobileSearchOpen={filters.mobileSearchOpen}
      onMobileSearchOpen={() => {
        filters.setMobileSearchOpen(true);
        filters.setMobileFiltersOpen(false);
      }}
      onMobileSearchClose={() => filters.setMobileSearchOpen(false)}
      mobileSearchValue={mobileSearchValue}
      onMobileSearchChange={setMobileSearchValue}
      showMobileFilter={nav.activeTab === 'history' || nav.activeTab === 'watchlist'}
      mobileFilterActive={filters.yearFilter !== 'all' || filters.sortOrder !== 'newest'}
      mobileFiltersOpen={filters.mobileFiltersOpen}
      onMobileFilterToggle={() => (filters.mobileFiltersOpen ? closeFilters() : openFilters())}
      storageError={storageError}
      traktNotice={traktNotice}
      shareNotice={shareNotice}
    >
      {(nav.activeTab === 'history' || nav.activeTab === 'watchlist') && (
        <CollectionPage
          isWatchlist={isWatchlist}
          movies={movies}
          visibleMovies={filters.visibleMovies}
          query={filters.query}
          onQueryChange={filters.setQuery}
          years={filters.years}
          yearFilter={filters.yearFilter}
          onYearFilterChange={filters.changeYearFilter}
          sortOrder={filters.sortOrder}
          onSortOrderChange={(value: SortOrder) => filters.changeSortOrder(value)}
          collectionView={filters.collectionView}
          onCollectionViewChange={filters.changeCollectionView}
          onAdd={() => openMovieDialog()}
          onDiscover={() => nav.switchTab('discover')}
          onOpenSettings={openSettings}
          onEdit={(movie) => openMovieDialog(movie)}
          onDelete={removeMovie}
          onOpen={openMovie}
        />
      )}

      {nav.discoverMounted && (
        <Suspense fallback={null}>
          <DiscoverPage
            hidden={nav.activeTab !== 'discover'}
            collection={movies}
            query={discoverQuery}
            onQueryChange={setDiscoverQuery}
            onAdd={(movie, status) => Boolean(saveDiscoveredMovie(movie, status))}
            onOpen={openDiscoveredDetails}
          />
        </Suspense>
      )}

      {nav.activeTab === 'insights' && (
        <Suspense fallback={null}>
          <InsightsPage movies={movies} onOpen={openMovie} />
        </Suspense>
      )}

      {selectedMovie && (
        <MovieDetailsPage
          movie={selectedMovie}
          discoveryPreview={Boolean(selectedDiscoveryMovie)}
          onSetStatus={(status) => setMovieStatusFromDetails(selectedMovie, status)}
          onSetRating={(rating) => setMovieRatingFromDetails(selectedMovie, rating)}
          onRemove={() => removeMovieFromDetails(selectedMovie.id)}
          onEdit={selectedDiscoveryMovie ? undefined : (movie) => openMovieDialog(movie)}
          onClose={closeDetails}
          onEnrich={enrichMovie}
        />
      )}

      <AgendaPage open={agendaOpen} movies={movies} onClose={closeAgenda} onOpen={openMovieFromAgenda} />
      <FilterDialog
        open={filters.mobileFiltersOpen}
        years={filters.years}
        yearFilter={filters.yearFilter}
        onYearFilterChange={filters.changeYearFilter}
        sortOrder={filters.sortOrder}
        onSortOrderChange={filters.changeSortOrder}
        onReset={filters.resetFilters}
        onClose={closeFilters}
      />
      <MovieDialog open={movieDialogOpen} movie={editingMovie} onClose={closeMovieDialog} onSave={handleSave} />
      <SettingsDialog
        open={settingsOpen}
        onClose={closeSettings}
        trakt={trakt}
        onConnectTrakt={connectTrakt}
        onDisconnectTrakt={disconnectTrakt}
        onSyncTrakt={syncTraktMovies}
        themeMode={themeMode}
        onThemeModeChange={changeThemeMode}
        onExport={exportCollection}
        onImport={importCollection}
      />
    </AppShell>
  );
}
