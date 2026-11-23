import { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';
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
import { useTraktSync } from '@/features/settings/useTraktSync';
import { useDetailsFlow } from './useDetailsFlow';
import { useSharedMovieLink } from './useSharedMovieLink';
import { useMovieDialog } from './useMovieDialog';

const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const InsightsPage = lazy(() => import('@/features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })));
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { readOverlay } from '@/lib/overlayState';
import { downloadBackup, importBackup, type ImportMode } from '@/services/backup';
import { applyTheme, getStoredThemeMode, saveThemeMode, type ThemeMode } from '@/services/theme';
import { migrateSettings } from '@/services/settingsStore';

export default function App() {
  const collection = useCollection();
  const { movies, storageError } = collection;
  const nav = useAppNavigation();
  const isWatchlist = nav.activeTab === 'watchlist';
  const filters = useCollectionFilters(movies, isWatchlist);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const { trakt, traktNotice, connectTrakt, disconnectTrakt, syncTraktMovies } = useTraktSync(collection);
  const details = useDetailsFlow(collection);
  const {
    selectedMovie,
    selectedDiscoveryMovie,
    setSelectedMovie,
    openMovie,
    openDiscoveredDetails,
    closeDetails,
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

  useEffect(() => {
    filters.closeMobilePanels();
  }, [nav.activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const mobileSearchValue = nav.activeTab === 'discover' ? discoverQuery : filters.query;
  const setMobileSearchValue = nav.activeTab === 'discover' ? setDiscoverQuery : filters.setQuery;

  return (
    <AppShell
      activeTab={nav.activeTab}
      onSwitchTab={(tab) => {
        filters.closeMobilePanels();
        nav.switchTab(tab);
      }}
      onOpenSettings={() => openSimple(settingsOpen, setSettingsOpen, settingsOverlay)}
      onOpenAgenda={() => openSimple(agendaOpen, setAgendaOpen, agendaOverlay)}
      onAdd={() => movieDialog.openDialog()}
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
          query={filters.query}
          onQueryChange={filters.setQuery}
          years={filters.years}
          yearFilter={filters.yearFilter}
          onYearFilterChange={filters.changeYearFilter}
          sortOrder={filters.sortOrder}
          onSortOrderChange={(value: SortOrder) => filters.changeSortOrder(value)}
          collectionView={filters.collectionView}
          onCollectionViewChange={filters.changeCollectionView}
          onAdd={() => movieDialog.openDialog()}
          onDiscover={() => nav.switchTab('discover')}
          onOpenSettings={() => openSimple(settingsOpen, setSettingsOpen, settingsOverlay)}
          onEdit={movieDialog.openDialog}
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
