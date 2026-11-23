import { getFreshTraktCredentials, type TraktCredentials } from './traktAuth';

export interface TraktMovieRef {
  title: string;
  year?: number;
  ids: { tmdb?: number; trakt?: number; imdb?: string };
}

export interface TraktWatchedMovie {
  plays: number;
  last_watched_at?: string;
  movie: TraktMovieRef;
}

export interface TraktWatchlistMovie {
  rank?: number;
  listed_at?: string;
  movie: TraktMovieRef;
}

async function fetchPaged<T>(path: string, credentials: TraktCredentials, signal?: AbortSignal): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await fetch(`https://api.trakt.tv${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`, {
      signal,
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': credentials.clientId,
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    if (response.status === 401) throw new Error('Trakt access has expired. Connect your account again.');
    if (!response.ok)
      throw new Error(`Your Trakt ${path.includes('watchlist') ? 'watchlist' : 'watch history'} could not be fetched.`);
    results.push(...((await response.json()) as T[]));
    pageCount = Number(response.headers.get('x-pagination-page-count')) || 1;
    page += 1;
  } while (page <= pageCount);
  return results;
}

export async function getWatchedMovies(
  initial: TraktCredentials,
  onCredentials: (credentials: TraktCredentials) => void,
  signal?: AbortSignal,
): Promise<TraktWatchedMovie[]> {
  const credentials = await getFreshTraktCredentials(initial, onCredentials);
  return fetchPaged<TraktWatchedMovie>('/sync/watched/movies?extended=full', credentials, signal);
}

export async function getWatchlistMovies(
  initial: TraktCredentials,
  onCredentials: (credentials: TraktCredentials) => void,
  signal?: AbortSignal,
): Promise<TraktWatchlistMovie[]> {
  const credentials = await getFreshTraktCredentials(initial, onCredentials);
  return fetchPaged<TraktWatchlistMovie>('/sync/watchlist/movies?extended=full', credentials, signal);
}
