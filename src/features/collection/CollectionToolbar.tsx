import { SearchField } from '@/components/ui/SearchField';
import { ViewToggle } from './ViewToggle';
import type { CollectionView, SortOrder } from './useCollectionFilters';

interface Props {
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
}

export function CollectionToolbar({
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
}: Props) {
  return (
    <div className="toolbar">
      <SearchField
        value={query}
        onChange={onQueryChange}
        label="Search movies"
        placeholder="Search by movie title…"
        focusRequest={focusRequest}
        onFocus={onSearchFocus}
      />
      <div className="collection-controls">
        <ViewToggle view={collectionView} onChange={onCollectionViewChange} />
        <label className={`select-control${yearFilter !== 'all' ? ' active' : ''}`}>
          <span className="select-label-text">Year</span>
          <select
            aria-label="Filter by year"
            value={yearFilter}
            onChange={(event) => onYearFilterChange(event.target.value)}
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
            onChange={(event) => onSortOrderChange(event.target.value as SortOrder)}
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
  );
}
