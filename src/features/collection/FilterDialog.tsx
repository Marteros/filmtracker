import { useEffect, useRef } from 'react';
import { useModalScrollLock } from '@/hooks/useModalScrollLock';
import type { SortOrder } from './useCollectionFilters';

interface Props {
  open: boolean;
  years: string[];
  yearFilter: string;
  onYearFilterChange(value: string): void;
  sortOrder: SortOrder;
  onSortOrderChange(value: SortOrder): void;
  onReset(): void;
  onClose(): void;
}

export function FilterDialog({
  open,
  years,
  yearFilter,
  onYearFilterChange,
  sortOrder,
  onSortOrderChange,
  onReset,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalScrollLock(open);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="movie-dialog mobile-filter-dialog"
      id="mobile-filters"
      aria-labelledby="mobile-filters-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="dialog-head">
          <h2 id="mobile-filters-title">Filters</h2>
          <button type="button" className="close-button" aria-label="Close filters" onClick={onClose}>
            ×
          </button>
        </div>
        <label className="form-field">
          Year
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
        <label className="form-field">
          Sort
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
        <button className="save-button" type="submit">
          Done
        </button>
        <button className="remove-token" type="button" onClick={onReset}>
          Clear filters
        </button>
      </form>
    </dialog>
  );
}
