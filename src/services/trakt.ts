const API_ROOT = 'https://api.trakt.tv';
const AUTH_ROOT = 'https://auth.trakt.tv';
const VERIFIER_KEY = 'frame-trakt-pkce-verifier';
const STATE_KEY = 'frame-trakt-pkce-state';

// Enter the Client ID of your Trakt API app here (public client, no secret required).
// The Redirect URI in Trakt must match the app URL (e.g. https://marteros.github.io/filmtracker/ and http://localhost:5173/ for development).
export const TRAKT_CLIENT_ID = 'x8He9YCDNIBNgaLGYdyzEteTPN-qC6EpSzLn69tCtsM';

export interface TraktCredentials {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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

function randomVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function traktRedirectUri(): string {
  return new URL(import.meta.env.BASE_URL, window.location.href).href;
}

export async function beginTraktAuthorization(clientId: string): Promise<string> {
  const verifier = randomVerifier();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const url = new URL(`${AUTH_ROOT}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', traktRedirectUri());
  url.searchParams.set('code_challenge', base64Url(new Uint8Array(digest)));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return url.href;
}

export async function finishTraktAuthorization(
  clientId: string,
  code: string,
  returnedState: string,
): Promise<TraktCredentials> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  if (!verifier || !expectedState || returnedState !== expectedState) {
    throw new Error('The Trakt sign-in has expired or is invalid. Start connecting again.');
  }

  const response = await fetch(`${API_ROOT}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2' },
    body: JSON.stringify({
      code,
      client_id: clientId,
      redirect_uri: traktRedirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error('Trakt could not connect Frame. Check the Redirect URI and try again.');
  const payload = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    clientId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || '',
    expiresAt: Date.now() + (payload.expires_in || 0) * 1000,
  };
}

async function refreshTraktToken(credentials: TraktCredentials): Promise<TraktCredentials> {
  if (!credentials.refreshToken) throw new Error('Trakt access has expired. Connect your account again.');
  const response = await fetch(`${API_ROOT}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2' },
    body: JSON.stringify({
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      redirect_uri: traktRedirectUri(),
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error('Trakt access has expired. Connect your account again.');
  const payload = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    ...credentials,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || credentials.refreshToken,
    expiresAt: Date.now() + (payload.expires_in || 0) * 1000,
  };
}

async function getFreshTraktCredentials(
  initial: TraktCredentials,
  onCredentials: (credentials: TraktCredentials) => void,
): Promise<TraktCredentials> {
  let credentials = initial;
  if (credentials.expiresAt && credentials.expiresAt < Date.now() + 60_000) {
    credentials = await refreshTraktToken(credentials);
    onCredentials(credentials);
  }
  return credentials;
}

export async function getWatchedMovies(
  initial: TraktCredentials,
  onCredentials: (credentials: TraktCredentials) => void,
): Promise<TraktWatchedMovie[]> {
  const credentials = await getFreshTraktCredentials(initial, onCredentials);

  const results: TraktWatchedMovie[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await fetch(`${API_ROOT}/sync/watched/movies?extended=full&page=${page}&limit=100`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': credentials.clientId,
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    if (response.status === 401) throw new Error('Trakt access has expired. Connect your account again.');
    if (!response.ok) throw new Error('Your Trakt watch history could not be fetched.');
    results.push(...((await response.json()) as TraktWatchedMovie[]));
    pageCount = Number(response.headers.get('x-pagination-page-count')) || 1;
    page += 1;
  } while (page <= pageCount);
  return results;
}

export async function getWatchlistMovies(
  initial: TraktCredentials,
  onCredentials: (credentials: TraktCredentials) => void,
): Promise<TraktWatchlistMovie[]> {
  const credentials = await getFreshTraktCredentials(initial, onCredentials);

  const results: TraktWatchlistMovie[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await fetch(`${API_ROOT}/sync/watchlist/movies?extended=full&page=${page}&limit=100`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': credentials.clientId,
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    if (response.status === 401) throw new Error('Trakt access has expired. Connect your account again.');
    if (!response.ok) throw new Error('Your Trakt watchlist could not be fetched.');
    results.push(...((await response.json()) as TraktWatchlistMovie[]));
    pageCount = Number(response.headers.get('x-pagination-page-count')) || 1;
    page += 1;
  } while (page <= pageCount);
  return results;
}
