// Cloudflare Worker for Frame.
// Deploy this code in Cloudflare and set TMDB_TOKEN as an environment variable.

const PRODUCTION_ORIGIN = 'https://marteros.github.io';

const ALLOWED_PATHS = [
  /^\/3\/search\/movie$/,
  /^\/3\/movie\/(?:popular|top_rated|\d+)$/,
  /^\/3\/movie\/\d+\/credits$/,
  /^\/3\/trending\/movie\/(?:day|week)$/,
  /^\/3\/discover\/movie$/,
  /^\/3\/person\/\d+\/movie_credits$/,
];

function corsHeaders(origin) {
  const localDev = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?$/.test(origin);
  const allowed = origin === PRODUCTION_ORIGIN || localDev;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    Vary: 'Origin',
  };
  if (allowed) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function errorResponse(message, status, headers) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request.headers.get('Origin') || '');

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'GET') return errorResponse('Not allowed', 405, headers);
    if (!ALLOWED_PATHS.some((pattern) => pattern.test(url.pathname))) {
      return errorResponse('Not allowed', 403, headers);
    }

    const upstream = new URL(url.pathname, 'https://api.themoviedb.org');
    url.searchParams.forEach((value, key) => {
      if (key !== 'api_key') upstream.searchParams.append(key, value);
    });

    const response = await fetch(upstream, {
      headers: {
        Authorization: `Bearer ${env.TMDB_TOKEN}`,
        accept: 'application/json',
      },
    });

    const ttl = url.pathname.startsWith('/3/search/movie') ? 300 : 3600;
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': response.ok ? `public, max-age=${ttl}` : 'no-store',
      },
    });
  },
};
