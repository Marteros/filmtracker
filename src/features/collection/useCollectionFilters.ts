import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { matchesSearchQuery } from '@/lib/movie';
import type { Movie } from '@/types';

export type SortOrder = 'newest' | 'oldest' | 'title' | 'year' | 'rating';
export type CollectionView = 'grid' | 'list';

const COLLECTION_VIEW_KEY = 'frame-collection-view-v1';

function readCollectionView(): CollectionView {
  try {
    return localStorage.getItem(COLLECTION_VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function useCollectionFilters(movies: Movie[], isWatchlist: boolean, query: string) {
  const [yearFilter, setYearFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [collectionView, setCollectionView] = useState<CollectionView>(readCollectionView);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const suppressScrollBlurUntil = useRef(0);

  const statusMovies = useMemo(
    () => movies.filter((movie) => movie.status === (isWatchlist ? 'watchlist' : 'seen')),
    [isWatchlist, movies],
  );

  const years = useMemo(
    () =>
      [...new Set(movies.map((movie) => movie.year).filter((year): year is string => Boolean(year)))].sort(
        (a, b) => Number(b) - Number(a),
      ),
    [movies],
  );

  const visibleMovies = useMemo(() => {
    return statusMovies
      .filter((movie) => {
        const matchesQuery = matchesSearchQuery(movie, query);
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

  const changeCollectionView = useCallback((view: CollectionView) => {
    setCollectionView(view);
    try {
      localStorage.setItem(COLLECTION_VIEW_KEY, view);
    } catch {
      /* Keep the view preference local. */
    }
  }, []);

  const changeYearFilter = useCallback((value: string) => {
    setYearFilter(value);
    window.scrollTo(0, 0);
  }, []);

  const changeSortOrder = useCallback((value: SortOrder) => {
    setSortOrder(value);
    window.scrollTo(0, 0);
  }, []);

  const resetFilters = useCallback(() => {
    setYearFilter('all');
    setSortOrder('newest');
    window.scrollTo(0, 0);
  }, []);

  const closeMobilePanels = useCallback(() => {
    setMobileSearchOpen(false);
    setMobileFiltersOpen(false);
  }, []);

  /** Keep focus in the mobile search when a search-driven tab switch scrolls to the top. */
  const suppressSearchBlurOnScroll = useCallback(() => {
    suppressScrollBlurUntil.current = Date.now() + 600;
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    let armed = false;
    const timer = window.setTimeout(() => {
      armed = true;
    }, 300);
    function dismissKeyboardOnScroll() {
      if (!armed) return;
      if (Date.now() < suppressScrollBlurUntil.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === 'search') active.blur();
    }
    window.addEventListener('scroll', dismissKeyboardOnScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', dismissKeyboardOnScroll);
    };
  }, [mobileSearchOpen]);

  return {
    yearFilter,
    changeYearFilter,
    sortOrder,
    changeSortOrder,
    resetFilters,
    collectionView,
    changeCollectionView,
    mobileSearchOpen,
    setMobileSearchOpen,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    closeMobilePanels,
    suppressSearchBlurOnScroll,
    years,
    statusMovies,
    visibleMovies,
  };
}
