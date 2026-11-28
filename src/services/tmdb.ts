import type { TmdbCastMember, TmdbMovie, TmdbMovieDetails } from '@/types';

const API_ROOT = 'https://filmtracker-proxy.levonmarteros.workers.dev/3';
const IMAGE_ROOT = 'https://image.tmdb.org/t/p';

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'request',
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

async function requestJson<T>(
  url: URL,
  signal: AbortSignal,
  networkMessage: string,
  requestMessage: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TmdbError(networkMessage, 'network');
  }

  if (!response.ok) {
    if (response.status === 429) throw new TmdbError('Too many requests. Please try again in a moment.', 'request');
    throw new TmdbError(requestMessage, 'request');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new TmdbError(requestMessage, 'request');
  }
}

export async function searchMovies(query: string, signal: AbortSignal): Promise<TmdbMovie[]> {
  const url = new URL(`${API_ROOT}/search/movie`);
  url.searchParams.set('query', query);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', '1');

  const payload = await requestJson<{ results?: TmdbMovie[] }>(
    url,
    signal,
    'Check your internet connection and try again.',
    'Movie suggestions are temporarily unavailable.',
  );
  return (payload.results || []).filter((movie) => movie.id && movie.title);
}

export type DiscoveryCategory = 'trending' | 'popular' | 'top_rated';

export async function getDiscoveryMovies(
  category: DiscoveryCategory,
  signal: AbortSignal,
  genreId?: number,
  page = 1,
): Promise<TmdbMovie[]> {
  let url: URL;
  if (genreId !== undefined) {
    url = new URL(`${API_ROOT}/discover/movie`);
    url.searchParams.set('with_genres', String(genreId));
    url.searchParams.set('sort_by', category === 'top_rated' ? 'vote_average.desc' : 'popularity.desc');
    if (category === 'top_rated') url.searchParams.set('vote_count.gte', '200');
    url.searchParams.set('include_adult', 'false');
  } else if (category === 'trending') {
    url = new URL(`${API_ROOT}/trending/movie/week`);
  } else {
    url = new URL(`${API_ROOT}/movie/${category}`);
  }
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', String(page));

  const payload = await requestJson<{ results?: TmdbMovie[] }>(
    url,
    signal,
    'Discover is unavailable without an internet connection.',
    'Movie recommendations are temporarily unavailable.',
  );
  return (payload.results || []).filter((movie) => movie.id && movie.title);
}

export interface RandomMovieCriteria {
  genreId?: number;
  minRating?: number;
  fromYear?: number;
  toYear?: number;
  originalLanguage?: string;
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export async function getRandomDiscoveryMovie(
  criteria: RandomMovieCriteria,
  isExcluded: (movie: TmdbMovie) => boolean,
  signal: AbortSignal,
  avoidIds: ReadonlySet<number> = new Set(),
): Promise<TmdbMovie | null> {
  const base = new URL(`${API_ROOT}/discover/movie`);
  base.searchParams.set('include_adult', 'false');
  base.searchParams.set('include_video', 'false');
  base.searchParams.set('language', 'en-US');
  base.searchParams.set('sort_by', 'vote_average.desc');
  base.searchParams.set('vote_count.gte', String(criteria.minRating ? 100 : 50));
  if (criteria.genreId) base.searchParams.set('with_genres', String(criteria.genreId));
  if (criteria.minRating) base.searchParams.set('vote_average.gte', String(criteria.minRating));
  if (criteria.fromYear) base.searchParams.set('primary_release_date.gte', `${criteria.fromYear}-01-01`);
  if (criteria.toYear) base.searchParams.set('primary_release_date.lte', `${criteria.toYear}-12-31`);
  if (criteria.originalLanguage) base.searchParams.set('with_original_language', criteria.originalLanguage);

  const fetchPage = async (page: number) => {
    const url = new URL(base);
    url.searchParams.set('page', String(page));
    return await requestJson<{ results?: TmdbMovie[]; total_pages?: number }>(
      url,
      signal,
      'Check your internet connection and try again.',
      'Could not fetch a random movie.',
    );
  };

  const isUsable = (movie: TmdbMovie) => movie.id && movie.title && !isExcluded(movie);

  const first = await fetchPage(1);
  const totalPages = Math.max(1, Math.min(first.total_pages || 1, 500));
  const pageCache = new Map<number, { results?: TmdbMovie[]; total_pages?: number }>([[1, first]]);
  const getPage = async (page: number) => {
    const cached = pageCache.get(page);
    if (cached) return cached;
    const payload = await fetchPage(page);
    pageCache.set(page, payload);
    return payload;
  };
  const pickFrom = (movies: TmdbMovie[], avoidRecent: boolean) => {
    const usable = movies.filter(isUsable);
    const preferred = avoidRecent ? usable.filter((movie) => !avoidIds.has(movie.id)) : usable;
    const pool = preferred.length ? preferred : usable;
    return pool.length ? pool[randomInt(pool.length)] : null;
  };

  if (totalPages === 1) {
    return pickFrom(first.results || [], true);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const page = 1 + randomInt(totalPages);
    const payload = await getPage(page);
    const pick = pickFrom(payload.results || [], true);
    if (pick) return pick;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const page = 1 + randomInt(totalPages);
    const payload = await getPage(page);
    const pick = pickFrom(payload.results || [], false);
    if (pick) return pick;
  }

  return pickFrom(first.results || [], false);
}

export async function getMovieDetails(id: number, signal: AbortSignal): Promise<TmdbMovieDetails> {
  const url = new URL(`${API_ROOT}/movie/${id}`);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('append_to_response', 'videos');
  return await requestJson<TmdbMovieDetails>(
    url,
    signal,
    'Movie details could not be fetched right now. Check your internet connection.',
    'Movie details are temporarily unavailable.',
  );
}

export async function getMovieCast(id: number, signal: AbortSignal): Promise<TmdbCastMember[]> {
  const url = new URL(`${API_ROOT}/movie/${id}/credits`);
  url.searchParams.set('language', 'en-US');
  const payload = await requestJson<{ cast?: TmdbCastMember[] }>(
    url,
    signal,
    'Cast could not be fetched. Check your internet connection.',
    'Cast could not be fetched.',
  );
  return (payload.cast || []).sort((a, b) => a.order - b.order);
}

export async function getActorMovieCredits(id: number, signal: AbortSignal): Promise<TmdbMovie[]> {
  const url = new URL(`${API_ROOT}/person/${id}/movie_credits`);
  url.searchParams.set('language', 'en-US');
  const payload = await requestJson<{ cast?: TmdbMovie[] }>(
    url,
    signal,
    'This actor’s movies could not be fetched. Check your internet connection.',
    'This actor’s movies could not be fetched.',
  );
  return (payload.cast || []).sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
}

export function tmdbPoster(path: string | null | undefined, size = 'w342'): string | undefined {
  return path ? `${IMAGE_ROOT}/${size}${path}` : undefined;
}
