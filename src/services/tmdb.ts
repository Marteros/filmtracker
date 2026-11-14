import type { TmdbCastMember, TmdbGenre, TmdbMovie, TmdbMovieDetails } from '../types';

const API_ROOT = 'https://api.themoviedb.org/3';
const IMAGE_ROOT = 'https://image.tmdb.org/t/p';

export class TmdbError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'network' | 'request') {
    super(message);
    this.name = 'TmdbError';
  }
}

export async function searchMovies(query: string, token: string, signal: AbortSignal): Promise<TmdbMovie[]> {
  const url = new URL(`${API_ROOT}/search/movie`);
  url.searchParams.set('query', query);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', 'nl-NL');
  url.searchParams.set('page', '1');

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TmdbError('Controleer je internetverbinding en probeer opnieuw.', 'network');
  }

  if (response.status === 401) throw new TmdbError('Deze TMDb-token is ongeldig. Controleer je instellingen.', 'auth');
  if (!response.ok) throw new TmdbError('Filmsuggesties zijn tijdelijk niet beschikbaar.', 'request');
  const payload = await response.json() as { results?: TmdbMovie[] };
  return (payload.results || []).filter((movie) => movie.id && movie.title);
}

export type DiscoveryCategory = 'trending' | 'popular' | 'top_rated';

export async function getDiscoveryMovies(
  category: DiscoveryCategory,
  token: string,
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

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TmdbError('Ontdekken lukt niet zonder internetverbinding.', 'network');
  }
  if (response.status === 401) throw new TmdbError('Deze TMDb-token is ongeldig. Controleer je instellingen.', 'auth');
  if (!response.ok) throw new TmdbError('Filmaanbevelingen zijn tijdelijk niet beschikbaar.', 'request');
  const payload = await response.json() as { results?: TmdbMovie[] };
  return (payload.results || []).filter((movie) => movie.id && movie.title);
}

export async function getMovieGenres(token: string, signal: AbortSignal): Promise<TmdbGenre[]> {
  const url = new URL(`${API_ROOT}/genre/movie/list`);
  url.searchParams.set('language', 'nl-NL');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TmdbError('Genres laden lukt niet zonder internetverbinding.', 'network');
  }
  if (response.status === 401) throw new TmdbError('Deze TMDb-token is ongeldig. Controleer je instellingen.', 'auth');
  if (!response.ok) throw new TmdbError('Genres zijn tijdelijk niet beschikbaar.', 'request');
  const payload = await response.json() as { genres?: TmdbGenre[] };
  return payload.genres || [];
}

export async function getMovieDetails(id: number, token: string, signal: AbortSignal): Promise<TmdbMovieDetails> {
  const url = new URL(`${API_ROOT}/movie/${id}`);
  url.searchParams.set('language', 'nl-NL');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TmdbError('Filmgegevens kunnen nu niet worden opgehaald. Controleer je internetverbinding.', 'network');
  }
  if (response.status === 401) throw new TmdbError('De TMDb-token is ongeldig. Controleer je instellingen.', 'auth');
  if (!response.ok) throw new TmdbError('Filmgegevens zijn tijdelijk niet beschikbaar.', 'request');
  return await response.json() as TmdbMovieDetails;
}

export async function getMovieCast(id: number, token: string, signal: AbortSignal): Promise<TmdbCastMember[]> {
  const url = new URL(`${API_ROOT}/movie/${id}/credits`);
  url.searchParams.set('language', 'nl-NL');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal });
  if (!response.ok) throw new TmdbError('De acteurs konden niet worden opgehaald.', response.status === 401 ? 'auth' : 'request');
  const payload = await response.json() as { cast?: TmdbCastMember[] };
  return (payload.cast || []).sort((a, b) => a.order - b.order);
}

export async function getActorMovieCredits(id: number, token: string, signal: AbortSignal): Promise<TmdbMovie[]> {
  const url = new URL(`${API_ROOT}/person/${id}/movie_credits`);
  url.searchParams.set('language', 'nl-NL');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal });
  if (!response.ok) throw new TmdbError('De films van deze acteur konden niet worden opgehaald.', response.status === 401 ? 'auth' : 'request');
  const payload = await response.json() as { cast?: TmdbMovie[] };
  return (payload.cast || []).sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
}

export function tmdbPoster(path: string | null | undefined, size = 'w342'): string | undefined {
  return path ? `${IMAGE_ROOT}/${size}${path}` : undefined;
}
