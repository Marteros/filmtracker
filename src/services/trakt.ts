const API_ROOT = 'https://api.trakt.tv';

export interface TraktCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
}

export interface TraktDeviceCode {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
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

function apiHeaders(clientId: string, accessToken?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function requestDeviceCode(clientId: string): Promise<TraktDeviceCode> {
  const response = await fetch(`${API_ROOT}/oauth/device/code`, {
    method: 'POST', headers: apiHeaders(clientId), body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) throw new Error('Trakt kon geen koppelcode maken. Controleer je Client ID en probeer opnieuw.');
  return await response.json() as TraktDeviceCode;
}

export async function authorizeDevice(credentials: TraktCredentials, deviceCode: string): Promise<string> {
  const response = await fetch(`${API_ROOT}/oauth/device/token`, {
    method: 'POST', headers: apiHeaders(credentials.clientId),
    body: JSON.stringify({ code: deviceCode, client_id: credentials.clientId, client_secret: credentials.clientSecret }),
  });
  if (response.status === 400 || response.status === 404) throw new Error('Nog niet goedgekeurd. Bevestig de code op Trakt en probeer opnieuw.');
  if (!response.ok) throw new Error('Trakt-koppeling mislukt. Controleer je Client ID en Client Secret.');
  const payload = await response.json() as { access_token: string };
  return payload.access_token;
}

export async function getWatchedMovies(clientId: string, accessToken: string): Promise<TraktWatchedMovie[]> {
  const results: TraktWatchedMovie[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await fetch(`${API_ROOT}/sync/watched/movies?extended=full&page=${page}&limit=100`, {
      headers: apiHeaders(clientId, accessToken),
    });
    if (response.status === 401) throw new Error('De Trakt-toegang is verlopen. Koppel je account opnieuw.');
    if (!response.ok) throw new Error('Je Trakt-kijkgeschiedenis kon niet worden opgehaald.');
    results.push(...await response.json() as TraktWatchedMovie[]);
    pageCount = Number(response.headers.get('x-pagination-page-count')) || 1;
    page += 1;
  } while (page <= pageCount);
  return results;
}
