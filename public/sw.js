const CACHE_NAME = 'frame-shell-v4';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    const indexResponse = await fetch('./index.html');
    if (!indexResponse.ok) throw new Error('Unable to precache app shell');
    const html = await indexResponse.text();
    await cache.put('./index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    const assetPaths = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)]
      .map((match) => match[1])
      .filter((path) => path.startsWith('./assets/'));
    if (assetPaths.length) await cache.addAll(assetPaths);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('frame-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  }));
});
