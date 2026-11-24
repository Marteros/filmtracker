import type { Movie } from '@/types';
import { MovieGrid } from './MovieGrid';
import { ViewToggle } from './ViewToggle';
import { CollectionToolbar } from './CollectionToolbar';
import type { CollectionView, SortOrder } from './useCollectionFilters';

interface Props {
  isWatchlist: boolean;
  movies: Movie[];
  visibleMovies: Movie[];
  query: string;
  onQueryChange(value: string): void;
  focusRequest?: number;
  onSearchFocus?(): void;
  years: string[];
  yearFilter: string;
  onYearFilterChange(value: string): void;
  sortOrder: SortOrder;
  onSortOrderChange(value: SortOrder): void;
  collectionView: CollectionView;
  onCollectionViewChange(view: CollectionView): void;
  onAdd(): void;
  onDiscover(): void;
  onOpenSettings(): void;
  onEdit(movie: Movie): void;
  onDelete(id: string): void;
  onOpen(movie: Movie): void;
}

export function CollectionPage({
  isWatchlist,
  movies,
  visibleMovies,
  query,
  onQueryChange,
  focusRequest,
  onSearchFocus,
  years,
  yearFilter,
  onYearFilterChange,
  sortOrder,
  onSortOrderChange,
  collectionView,
  onCollectionViewChange,
  onAdd,
  onDiscover,
  onOpenSettings,
  onEdit,
  onDelete,
  onOpen,
}: Props) {
  const collectionCount = isWatchlist
    ? movies.filter((movie) => movie.status === 'watchlist').length
    : movies.filter((movie) => movie.status === 'seen').length;

  const emptyMessage =
    query && !visibleMovies.length
      ? 'No search results'
      : !collectionCount && yearFilter !== 'all'
        ? 'No movies match your filters'
        : !collectionCount
          ? isWatchlist
            ? 'No movies on your watchlist yet'
            : 'No seen movies yet'
          : undefined;

  return (
    <main className="app">
      <section className="collection" aria-label={isWatchlist ? 'Watchlist' : 'Seen'}>
        <div className="mobile-collection-heading">
          <div className="mobile-collection-title">
            <h1>{isWatchlist ? 'Watchlist' : 'Seen'}</h1>
            <span aria-label={`${collectionCount} ${collectionCount === 1 ? 'movie' : 'movies'}`}>
              {collectionCount}
            </span>
          </div>
          <ViewToggle view={collectionView} onChange={onCollectionViewChange} className="mobile-view-toggle" />
        </div>
        <CollectionToolbar
          query={query}
          onQueryChange={onQueryChange}
          focusRequest={focusRequest}
          onSearchFocus={onSearchFocus}
          years={years}
          yearFilter={yearFilter}
          onYearFilterChange={onYearFilterChange}
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
          collectionView={collectionView}
          onCollectionViewChange={onCollectionViewChange}
        />
        <MovieGrid
          view={collectionView}
          movies={visibleMovies}
          collectionHasMovies={movies.length > 0}
          emptyMessage={emptyMessage}
          onAdd={onAdd}
          onDiscover={onDiscover}
          onOpenSettings={onOpenSettings}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      </section>
    </main>
  );
}
