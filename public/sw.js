/*
 * Athlete OS service worker — hand-rolled, zero deps (ADR-017).
 * Scope: offline SHELL only. Reads: navigations network-first with cached
 * fallback; immutable assets cache-first. Writes (POST server actions) are
 * NEVER intercepted — offline writes live in the IndexedDB queue in the app.
 * Bump VERSION to invalidate all caches on deploy of a new SW.
 */
const VERSION = 'v2';
const STATIC_CACHE = `aos-static-${VERSION}`;
const PAGES_CACHE = `aos-pages-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first; offline falls back to the last cached copy
  // of the same page (full app shell, capture forms included), then /offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Skip redirected responses (e.g. auth bounce to /login): caching
          // them under the requested URL would pin the wrong page.
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            event.waitUntil(caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline ?? Response.error();
        }),
    );
    return;
  }

  // Hashed build assets and icons are immutable: cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)));
            }
            return response;
          }),
      ),
    );
  }
});
