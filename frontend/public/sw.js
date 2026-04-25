const CACHE_VERSION = 'v1';
const SHELL_CACHE = `chengeto-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `chengeto-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const isSameOriginGet = (request) => request.method === 'GET' && new URL(request.url).origin === self.location.origin;

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // SPA navigation: network-first, fallback to cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/index.html', response.clone()).catch(() => {});
          return response;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match('/index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Avoid caching API calls.
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Same-origin static assets: cache-first with runtime fallback.
  if (isSameOriginGet(request)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone()).catch(() => {});
          return response;
        } catch {
          return Response.error();
        }
      })()
    );
  }
});
