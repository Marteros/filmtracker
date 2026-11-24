import { matchesSearchQuery } from '@/lib/movie';
import type { Movie } from '@/types';
import type { AppTab } from './useAppNavigation';

export type SearchDestination = Extract<AppTab, 'history' | 'watchlist' | 'discover'>;

/**
 * Decide which page should own the current search query.
 * Seen wins over Watchlist when both contain a match. A query that matches
 * nothing locally falls through to Discover, but only from 2 characters so a
 * single keystroke does not fire a remote TMDb search.
 */
export function resolveSearchDestination(movies: Movie[], query: string): SearchDestination | null {
  const normalized = query.trim();
  if (!normalized) return null;
  const matches = movies.filter((movie) => matchesSearchQuery(movie, normalized));
  if (matches.some((movie) => movie.status === 'seen')) return 'history';
  if (matches.some((movie) => movie.status === 'watchlist')) return 'watchlist';
  return normalized.length >= 2 ? 'discover' : null;
}
