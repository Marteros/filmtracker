import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppShell } from './AppShell';
import { useAppNavigation, type AppTab } from './useAppNavigation';
import { useCollection } from './useCollection';
import { CollectionPage } from '@/features/collection/CollectionPage';
import { FilterDialog } from '@/features/collection/FilterDialog';
import { MovieDialog } from '@/features/collection/MovieDialog';
import { useCollectionFilters, type SortOrder } from '@/features/collection/useCollectionFilters';
import { MovieDetailsPage } from '@/features/details/MovieDetailsPage';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { useTraktSync } from '@/features/settings/useTraktSync';
import { useDetailsFlow } from './useDetailsFlow';
import { useSharedMovieLink } from './useSharedMovieLink';
import { useMovieDialog } from './useMovieDialog';
import { useTrackpadBackGesture } from '@/hooks/useTrackpadBackGesture';
import { resolveSearchDestination } from './useGlobalSearch';
import { DiscoverPageSkeleton } from '@/components/ui/DiscoverPageSkeleton';
import { InsightsPageSkeleton } from '@/components/ui/InsightsPageSkeleton';

const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const InsightsPage = lazy(() => import('@/features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })));
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { readOverlay } from '@/lib/overlayState';
import { downloadBackup, importBackup, type ImportMode } from '@/services/backup';
import { applyTheme, getStoredThemeMode, saveThemeMode, type ThemeMode } from '@/services/theme';
import { migrateSettings } from '@/services/settingsStore';

export default function App() {
  useTrackpadBackGesture();
  const collection = useCollection();
  const { movies, storageError } = collection;
  const nav = useAppNavigation();
  const isWatchlist = nav.activeTab === 'watchlist';
  const [searchQuery, setSearchQuery] = useState('');
  const searchOriginTab = useRef<AppTab | null>(null);
  /** Bumped on search-driven page switches so the destination search field keeps focus. */
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const filters = useCollectionFilters(movies, isWatchlist, searchQuery);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const discoverPrefetched = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const { trakt, traktNotice, connectTrakt, disconnectTrakt, syncTraktMovies } = useTraktSync(collection);
  const details = useDetailsFlow(collection);
  const {
    selectedMovie,
    selectedDiscoveryMovie,
    historyActor,
    setSelectedMovie,
    openMovie,
    openDiscoveredDetails,
    selectDetailsActor,
    closeDetails,
    closeAllDetails,
    saveDiscoveredMovie,
    setMovieStatusFromDetails,
    setMovieRatingFromDetails,
    removeMovieFromDetails,
    enrichMovie,
  } = details;
  const shareNotice = useSharedMovieLink(openDiscoveredDetails);
  const movieDialog = useMovieDialog(collection, selectedMovie, setSelectedMovie);

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
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Restore overlays from an existing history entry (forward navigation / reload with state).
  useEffect(() => {
    const state = window.history.state;
    if (readOverlay(state, 'frameSettings')) setSettingsOpen(true);
    if (readOverlay(state, 'frameAgenda')) setAgendaOpen(true);
    if (readOverlay(state, 'frameFilters')) filters.setMobileFiltersOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(tab: AppTab) {
    searchOriginTab.current = searchQuery.trim() ? tab : null;
    filters.setMobileFiltersOpen(false);
    if (!searchQuery.trim()) filters.setMobileSearchOpen(false);
    nav.switchTab(tab);
  }

  /** Load the Discover chunk before a search can route there. */
  function prefetchDiscover() {
    if (discoverPrefetched.current) return;
    discoverPrefetched.current = true;
    void import('@/features/discover/DiscoverPage');
  }

  /**
   * One search box for the whole app; searches always route to Discover.
   */
  function changeSearchQuery(value: string) {
    setSearchQuery(value);
    if (value.trim().length >= 2) prefetchDiscover();
    const destination = resolveSearchDestination(value);
    if (destination && destination !== nav.activeTab) {
      searchOriginTab.current ??= nav.activeTab;
      filters.suppressSearchBlurOnScroll();
      nav.switchTab(destination);
      setSearchFocusRequest((request) => request + 1);
    }
  }

  function cancelSearch() {
    const destination = searchOriginTab.current ?? nav.activeTab;
    searchOriginTab.current = null;
    setSearchQuery('');
    filters.setMobileSearchOpen(false);
    filters.setMobileFiltersOpen(false);
    if (destination !== nav.activeTab) nav.switchTab(destination);
  }

  function openSimple(isOpen: boolean, setOpen: (v: boolean) => void, overlay: { open: (v: boolean) => void }) {
    if (isOpen) return;
    setOpen(true);
    overlay.open(true);
  }
  function openFilters() {
    if (filters.mobileFiltersOpen) return;
    filters.setMobileSearchOpen(false);
    filters.setMobileFiltersOpen(true);
    filtersOverlay.open(true);
  }
  function removeMovie(id: string): boolean {
    const movie = collection.findById(id);
    if (!movie || !window.confirm(`Remove “${movie.title}” from your collection?`)) return false;
    return collection.removeMovie(id);
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

  return (
    <AppShell
      activeTab={nav.activeTab}
      onSwitchTab={switchTab}
      onOpenSettings={() => openSimple(settingsOpen, setSettingsOpen, settingsOverlay)}
      onOpenAgenda={() => openSimple(agendaOpen, setAgendaOpen, agendaOverlay)}
      mobileSearchOpen={filters.mobileSearchOpen}
      onMobileSearchOpen={() => {
        searchOriginTab.current = nav.activeTab;
        filters.setMobileSearchOpen(true);
        filters.setMobileFiltersOpen(false);
      }}
      onMobileSearchClose={cancelSearch}
      searchValue={searchQuery}
      onSearchChange={changeSearchQuery}
      onSearchFocus={prefetchDiscover}
      showMobileFilter={nav.activeTab === 'history' || nav.activeTab === 'watchlist'}
      mobileFilterActive={filters.yearFilter !== 'all' || filters.sortOrder !== 'newest'}
      mobileFiltersOpen={filters.mobileFiltersOpen}
      onMobileFilterToggle={() => (filters.mobileFiltersOpen ? filtersOverlay.close() : openFilters())}
      storageError={storageError}
      traktNotice={traktNotice}
      shareNotice={shareNotice}
    >
      {(nav.activeTab === 'history' || nav.activeTab === 'watchlist') && (
        <CollectionPage
          isWatchlist={isWatchlist}
          movies={movies}
          visibleMovies={filters.visibleMovies}
          query={searchQuery}
          onQueryChange={changeSearchQuery}
          focusRequest={searchFocusRequest}
          onSearchFocus={prefetchDiscover}
          years={filters.years}
          yearFilter={filters.yearFilter}
          onYearFilterChange={filters.changeYearFilter}
          sortOrder={filters.sortOrder}
          onSortOrderChange={(value: SortOrder) => filters.changeSortOrder(value)}
          collectionView={filters.collectionView}
          onCollectionViewChange={filters.changeCollectionView}
          onDiscover={() => switchTab('discover')}
          onOpenSettings={() => openSimple(settingsOpen, setSettingsOpen, settingsOverlay)}
          onEdit={movieDialog.openDialog}
          onDelete={removeMovie}
          onOpen={openMovie}
        />
      )}

      {nav.discoverMounted && (
        <Suspense fallback={<DiscoverPageSkeleton variant={searchQuery.trim() ? 'search' : 'overview'} />}>
          <DiscoverPage
            hidden={nav.activeTab !== 'discover'}
            collection={movies}
            query={searchQuery}
            onQueryChange={changeSearchQuery}
            focusRequest={searchFocusRequest}
            onSearchFocus={prefetchDiscover}
            onAdd={(movie, status) => Boolean(saveDiscoveredMovie(movie, status))}
            onOpen={openDiscoveredDetails}
          />
        </Suspense>
      )}

      {nav.activeTab === 'insights' && (
        <Suspense fallback={<InsightsPageSkeleton />}>
          <InsightsPage movies={movies} onOpen={openMovie} />
        </Suspense>
      )}

      {selectedMovie && (
        <MovieDetailsPage
          movie={selectedMovie}
          historyActor={historyActor}
          onCloseAll={closeAllDetails}
          onSelectActor={selectDetailsActor}
          onOpenMovie={(movie) => openDiscoveredDetails(movie, true)}
          discoveryPreview={Boolean(selectedDiscoveryMovie)}
          onSetStatus={(status) => setMovieStatusFromDetails(selectedMovie, status)}
          onSetRating={(rating) => setMovieRatingFromDetails(selectedMovie, rating)}
          onRemove={() => removeMovieFromDetails(selectedMovie.id)}
          onEdit={selectedDiscoveryMovie ? undefined : movieDialog.openDialog}
          onClose={closeDetails}
          onEnrich={enrichMovie}
        />
      )}

      <AgendaPage open={agendaOpen} movies={movies} onClose={agendaOverlay.close} onOpen={openMovie} />
      <FilterDialog
        open={filters.mobileFiltersOpen}
        years={filters.years}
        yearFilter={filters.yearFilter}
        onYearFilterChange={filters.changeYearFilter}
        sortOrder={filters.sortOrder}
        onSortOrderChange={filters.changeSortOrder}
        onReset={filters.resetFilters}
        onClose={filtersOverlay.close}
      />
      <MovieDialog
        open={movieDialog.open}
        movie={movieDialog.editingMovie}
        onClose={movieDialog.closeDialog}
        onSave={movieDialog.handleSave}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={settingsOverlay.close}
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
