import type { TmdbMovie } from '../types';

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

export function tmdbPoster(path: string | null | undefined, size = 'w342'): string | undefined {
  return path ? `${IMAGE_ROOT}/${size}${path}` : undefined;
}
