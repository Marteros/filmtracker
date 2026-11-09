const API_ROOT = 'https://api.trakt.tv';
const AUTH_ROOT = 'https://auth.trakt.tv';
const VERIFIER_KEY = 'frame-trakt-pkce-verifier';
const STATE_KEY = 'frame-trakt-pkce-state';

export interface TraktCredentials {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TraktWatchedMovie {
  plays: number;
  last_watched_at?: string;
  movie: {
    title: string;
    year?: number;
    ids: { tmdb?: number; trakt?: number; imdb?: string };
  };
}

function randomVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
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

export async function finishTraktAuthorization(clientId: string, code: string, returnedState: string): Promise<TraktCredentials> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  if (!verifier || !expectedState || returnedState !== expectedState) {
    throw new Error('De Trakt-aanmelding is verlopen of ongeldig. Start het koppelen opnieuw.');
  }

  const response = await fetch(`${API_ROOT}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2' },
    body: JSON.stringify({
      code, client_id: clientId, redirect_uri: traktRedirectUri(),
      grant_type: 'authorization_code', code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error('Trakt heeft Frame niet kunnen koppelen. Controleer de Redirect URI en probeer opnieuw.');
  const payload = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    clientId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || '',
    expiresAt: Date.now() + (payload.expires_in || 0) * 1000,
  };
}

async function refreshTraktToken(credentials: TraktCredentials): Promise<TraktCredentials> {
  if (!credentials.refreshToken) throw new Error('De Trakt-toegang is verlopen. Koppel je account opnieuw.');
  const response = await fetch(`${API_ROOT}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2' },
    body: JSON.stringify({
      refresh_token: credentials.refreshToken, client_id: credentials.clientId,
      redirect_uri: traktRedirectUri(), grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error('De Trakt-toegang is verlopen. Koppel je account opnieuw.');
  const payload = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    ...credentials, accessToken: payload.access_token,
    refreshToken: payload.refresh_token || credentials.refreshToken,
    expiresAt: Date.now() + (payload.expires_in || 0) * 1000,
  };
}

export async function getWatchedMovies(initial: TraktCredentials, onCredentials: (credentials: TraktCredentials) => void): Promise<TraktWatchedMovie[]> {
  let credentials = initial;
  if (credentials.expiresAt && credentials.expiresAt < Date.now() + 60_000) {
    credentials = await refreshTraktToken(credentials);
    onCredentials(credentials);
  }

  const results: TraktWatchedMovie[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await fetch(`${API_ROOT}/sync/watched/movies?extended=full&page=${page}&limit=100`, {
      headers: {
        'Content-Type': 'application/json', 'trakt-api-version': '2',
        'trakt-api-key': credentials.clientId, Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    if (response.status === 401) throw new Error('De Trakt-toegang is verlopen. Koppel je account opnieuw.');
    if (!response.ok) throw new Error('Je Trakt-kijkgeschiedenis kon niet worden opgehaald.');
    results.push(...await response.json() as TraktWatchedMovie[]);
    pageCount = Number(response.headers.get('x-pagination-page-count')) || 1;
    page += 1;
  } while (page <= pageCount);
  return results;
}
