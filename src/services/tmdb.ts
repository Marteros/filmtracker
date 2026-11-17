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
