/* eslint-disable no-undef */
// Offline app-shell cache for the Sunmi V2 Pro (and any other terminal).
//
// Strategy: stale-while-revalidate for the Next.js build output, network-only
// for Firebase / API / dynamic pages. The terminal opens instantly on the
// second-and-later launch because the JS/CSS shell is read from cache;
// the SW kicks off a background fetch so the next launch already has fresh
// code. Firebase reads (auth, races, tickets) always hit the network so we
// never serve stale data for anything that matters.
//
// Bump CACHE_VERSION to invalidate everything on rollouts that change the
// caching strategy itself. Day-to-day code changes are picked up
// automatically because Next.js fingerprints filenames in /_next/static/.

const CACHE_VERSION = 'betese-shell-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

// Paths that are safe to cache aggressively and serve from cache first.
// Everything else is network-first / network-only.
const SHELL_MATCHES = [
  /^\/_next\/static\//,
  /^\/icon\.png$/,
  /^\/logo\.png$/,
  /^\/manifest\.json$/,
  /^\/animations\//,
  /^\/payment-logos\//,
];

const isShellRequest = (url) => {
  if (url.origin !== self.location.origin) return false;
  return SHELL_MATCHES.some((re) => re.test(url.pathname));
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Drop every legacy cache from the previous kill-switch SW so we start
  // clean without surfacing pre-Next.js artefacts.
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!isShellRequest(url)) return; // fall through to network

  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
