/*
 * Biryani Point service worker: makes the site installable and usable on a flaky
 * connection. Never caches the admin panel, the API or anything personal.
 *  - Pages: network first, then the last copy seen, then the offline page.
 *  - Build files (/_next/static): cache first (their names change every release).
 *  - Dish photos: served from cache, refreshed in the background.
 */
const VERSION = 'bp-v1';
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const IMAGES = `${VERSION}-images`;
const OFFLINE_URL = '/offline.html';
const MAX_IMAGES = 80;
const MAX_PAGES = 20;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/192', '/icon.svg']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Always live: kitchen, API, order tracking, checkout.
  if (/^\/(admin|api)(\/|$)/.test(url.pathname) || /\/(order|checkout)(\/|$)/.test(url.pathname))
    return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(PAGES)
              .then((cache) => cache.put(request, copy))
              .then(() => trim(PAGES, MAX_PAGES));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok)
              cache.put(request, response.clone()).then(() => trim(IMAGES, MAX_IMAGES));
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
