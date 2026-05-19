/* eslint-disable no-undef */
const CACHE_NAME = 'betese-pmu-v9';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {
        // Continue even if some assets fail to cache
      });
    }).catch(() => {
      // Continue on cache failure
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip POST, PUT, DELETE requests
  if (request.method !== 'GET') {
    return;
  }

  // Network first for JS/CSS chunks and API calls
  if (request.url.includes('/assets/') || request.url.includes('/rest/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).catch(() => {
            // Return default offline response
            if (request.destination === 'document') {
              return new Response('Offline - please check your connection', {
                status: 503,
                statusText: 'Service Unavailable',
              });
            }
          });
        })
    );
    return;
  }

  // Stale-while-revalidate for HTML
  event.respondWith(
    caches.match(request).then((response) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
      return response || fetchPromise;
    }).catch(() => {
      return caches.match(request);
    })
  );
});
