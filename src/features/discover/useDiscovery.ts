import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { getDiscoveryMovies, searchMovies, type DiscoveryCategory } from '@/services/tmdb';
import type { TmdbMovie } from '@/types';

export const DISCOVER_SECTIONS: Array<{ id: DiscoveryCategory; title: string }> = [
  { id: 'trending', title: 'Trending' },
  { id: 'popular', title: 'Popular' },
  { id: 'top_rated', title: 'Top rated' },
];

export function useDiscovery(query: string, enabled = true) {
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [searchResults, setSearchResults] = useState<TmdbMovie[]>([]);
  const [feeds, setFeeds] = useState<Partial<Record<DiscoveryCategory, TmdbMovie[]>>>({});
  const [selectedSection, setSelectedSection] = useState<DiscoveryCategory>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const overviewScrollRef = useRef(0);
  const restoreOverviewScrollRef = useRef<number | null>(null);

  const sectionOverlay = useHistoryOverlay<DiscoveryCategory>({
    key: 'frameSection',
    onChange: (section) => {
      if (section) {
        if (!selectedSection) overviewScrollRef.current = window.scrollY;
        setSelectedSection(section);
        setError('');
      } else {
        restoreOverviewScrollRef.current = overviewScrollRef.current;
        setSelectedSection(undefined);
        setError('');
      }
    },
  });

  useLayoutEffect(() => {
    if (selectedSection) {
      window.scrollTo(0, 0);
      return;
    }
    if (restoreOverviewScrollRef.current !== null) {
      const top = restoreOverviewScrollRef.current;
      restoreOverviewScrollRef.current = null;
      window.scrollTo(0, top);
    }
  }, [selectedSection]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (debouncedQuery.length >= 2) {
      searchMovies(debouncedQuery, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setSearchResults(results);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else if (debouncedQuery) {
      setSearchResults([]);
      setLoading(false);
    } else if (selectedSection) {
      setPage(1);
      setHasMore(true);
      getDiscoveryMovies(selectedSection, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return;
          setFeeds((current) => ({ ...current, [selectedSection]: results }));
          setHasMore(results.length >= 20);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else {
      Promise.all(
        DISCOVER_SECTIONS.map(async ({ id }) => [id, await getDiscoveryMovies(id, controller.signal)] as const),
      )
        .then((results) => {
          if (!controller.signal.aborted)
            setFeeds(Object.fromEntries(results) as Record<DiscoveryCategory, TmdbMovie[]>);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movies.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    return () => controller.abort();
  }, [debouncedQuery, retry, selectedSection, enabled]);

  function openSection(section: DiscoveryCategory) {
    overviewScrollRef.current = window.scrollY;
    setSelectedSection(section);
    setError('');
    sectionOverlay.open(section);
  }

  function closeSection() {
    sectionOverlay.close();
  }

  const loadMore = useCallback(async () => {
    if (!selectedSection || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const results = await getDiscoveryMovies(selectedSection, new AbortController().signal, undefined, nextPage);
      setFeeds((current) => {
        const existing = current[selectedSection] || [];
        const seen = new Set(existing.map((m) => m.id));
        const appended = results.filter((m) => !seen.has(m.id));
        return { ...current, [selectedSection]: [...existing, ...appended] };
      });
      setPage(nextPage);
      setHasMore(results.length >= 20);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load more movies.');
    } finally {
      setLoadingMore(false);
    }
  }, [selectedSection, loadingMore, hasMore, page]);

  return {
    debouncedQuery,
    searchResults,
    feeds,
    selectedSection,
    loading,
    loadingMore,
    hasMore,
    error,
    retry: () => setRetry((current) => current + 1),
    openSection,
    closeSection,
    loadMore,
  };
}
