import type { TmdbMovieDetails } from '@/types';
import { getMovieDetails } from '@/services/tmdb';

const detailsCache = new Map<number, TmdbMovieDetails>();

export async function getMovieDetailsCached(tmdbId: number, signal: AbortSignal): Promise<TmdbMovieDetails> {
  const cached = detailsCache.get(tmdbId);
  if (cached) return cached;
  const details = await getMovieDetails(tmdbId, signal);
  detailsCache.set(tmdbId, details);
  return details;
}

export function clearTmdbCache() {
  detailsCache.clear();
}
