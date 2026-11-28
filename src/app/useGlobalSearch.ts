import type { AppTab } from './useAppNavigation';

export type SearchDestination = Extract<AppTab, 'history' | 'watchlist' | 'discover'>;

/**
 * Keep search results in Discover; an empty query does not change pages.
 */
export function resolveSearchDestination(query: string): SearchDestination | null {
  return query.trim() ? 'discover' : null;
}
