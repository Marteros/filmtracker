import type { TmdbCastMember, TmdbMovie, TmdbMovieDetails } from '../types';

const API_ROOT = 'https://filmtracker-proxy.levonmarteros.workers.dev/3';
const IMAGE_ROOT = 'https://image.tmdb.org/t/p';

export class TmdbError extends Error {
  constructor(message: string, readonly kind: 'network' | 'request') {
    super(message);
    this.name = 'TmdbError';
  }
}

async function requestJson<T>(url: URL, signal: AbortSignal, networkMessage: string, requestMessage: string): Promise<T> {
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
    if (response.status === 429) throw new TmdbError('Even te veel aanvragen. Probeer het zo meteen opnieuw.', 'request');
    throw new TmdbError(requestMessage, 'request');
  }

  try {
    return await response.json() as T;
  } catch {
    throw new TmdbError(requestMessage, 'request');
  }
}

export async function searchMovies(query: string, signal: AbortSignal): Promise<TmdbMovie[]> {
  const url = new URL(`${API_ROOT}/search/movie`);
  url.searchParams.set('query', query);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', 'nl-NL');
  url.searchParams.set('page', '1');

  const payload = await requestJson<{ results?: TmdbMovie[] }>(
    url,
    signal,
    'Controleer je internetverbinding en probeer opnieuw.',
    'Filmsuggesties zijn tijdelijk niet beschikbaar.',
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
    url.searchParams.set('region', 'NL');
  } else if (category === 'trending') {
    url = new URL(`${API_ROOT}/trending/movie/week`);
  } else {
    url = new URL(`${API_ROOT}/movie/${category}`);
    if (category === 'top_rated') url.searchParams.set('region', 'NL');
  }
  url.searchParams.set('language', 'nl-NL');
  url.searchParams.set('page', String(page));

  const payload = await requestJson<{ results?: TmdbMovie[] }>(
    url,
    signal,
    'Ontdekken lukt niet zonder internetverbinding.',
    'Filmaanbevelingen zijn tijdelijk niet beschikbaar.',
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
  base.searchParams.set('language', 'nl-NL');
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
      'Controleer je internetverbinding en probeer opnieuw.',
      'Een willekeurige film ophalen is mislukt.',
    );
  };

  const isUsable = (movie: TmdbMovie) => movie.id && movie.title && !isExcluded(movie);

  const first = await fetchPage(1);
  const totalPages = Math.max(1, Math.min(first.total_pages || 1, 500));
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
    const page = attempt === 0 ? 1 : 1 + randomInt(totalPages);
    const payload = page === 1 ? first : await fetchPage(page);
    const pick = pickFrom(payload.results || [], true);
    if (pick) return pick;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const page = attempt === 0 ? 1 : 1 + randomInt(totalPages);
    const payload = page === 1 ? first : await fetchPage(page);
    const pick = pickFrom(payload.results || [], false);
    if (pick) return pick;
  }

  return pickFrom(first.results || [], false);
}

export async function getMovieDetails(id: number, signal: AbortSignal): Promise<TmdbMovieDetails> {
  const url = new URL(`${API_ROOT}/movie/${id}`);
  url.searchParams.set('language', 'nl-NL');
  return await requestJson<TmdbMovieDetails>(
    url,
    signal,
    'Filmgegevens kunnen nu niet worden opgehaald. Controleer je internetverbinding.',
    'Filmgegevens zijn tijdelijk niet beschikbaar.',
  );
}

export async function getMovieCast(id: number, signal: AbortSignal): Promise<TmdbCastMember[]> {
  const url = new URL(`${API_ROOT}/movie/${id}/credits`);
  url.searchParams.set('language', 'nl-NL');
  const payload = await requestJson<{ cast?: TmdbCastMember[] }>(
    url,
    signal,
    'De acteurs konden niet worden opgehaald. Controleer je internetverbinding.',
    'De acteurs konden niet worden opgehaald.',
  );
  return (payload.cast || []).sort((a, b) => a.order - b.order);
}

export async function getActorMovieCredits(id: number, signal: AbortSignal): Promise<TmdbMovie[]> {
  const url = new URL(`${API_ROOT}/person/${id}/movie_credits`);
  url.searchParams.set('language', 'nl-NL');
  const payload = await requestJson<{ cast?: TmdbMovie[] }>(
    url,
    signal,
    'De films van deze acteur konden niet worden opgehaald. Controleer je internetverbinding.',
    'De films van deze acteur konden niet worden opgehaald.',
  );
  return (payload.cast || []).sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
}

export function tmdbPoster(path: string | null | undefined, size = 'w342'): string | undefined {
  return path ? `${IMAGE_ROOT}/${size}${path}` : undefined;
}
