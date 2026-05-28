/* eslint-disable no-undef */
// KILL-SWITCH service worker.
//
// Previous Vite-based deployments registered a caching SW that, after the
// Next.js migration, kept serving cached HTML referencing assets that no
// longer exist (e.g. /index.tsx) — leaving users on a blank white page.
//
// This version takes over, deletes every cache it owns, and unregisters
// itself so subsequent loads bypass the SW entirely and go straight to the
// network (and Next.js's own asset hashing handles cache busting).
//
// Once it's been live long enough that the vast majority of users have
// picked it up, /public/service-worker.js can be deleted outright.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        try { client.navigate(client.url); } catch { /* navigate may be blocked; fall through */ }
      });
    })()
  );
});

// Pass-through fetch — never serve cached responses. Required because the
// SW remains active for the current page until activation completes; without
// this, Chrome's default no-op fetch handler is used (which is fine), but
// declaring it explicitly avoids any chance of intercepting with stale data.
self.addEventListener('fetch', () => { /* network only */ });
