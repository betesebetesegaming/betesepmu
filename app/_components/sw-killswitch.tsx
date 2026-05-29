'use client';

import { useEffect } from 'react';

// Current SW version — bump this string to force all browsers to re-register.
const SW_VERSION = 'shell-3';

// Registers the offline-shell service worker (public/service-worker.js).
// On every load we first unregister any stale SW from a previous version
// (including the old Vite-era SW registered from index.html). Stale SWs
// intercepting fetches is the #1 cause of Chrome crashing on low-memory
// terminals — the browser loops trying to update a SW that no longer matches
// the app shell, consuming all available memory.
// Works in Chrome, Edge, Firefox, and Safari — requestIdleCallback is
// guarded with a setTimeout(1500) fallback for Firefox/Safari.
export function SwKillswitch() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        // Step 1: unregister every stale SW (Vite-era ?v=20260525-1, old shell-2, etc.)
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          const url =
            reg.active?.scriptURL ||
            reg.installing?.scriptURL ||
            reg.waiting?.scriptURL ||
            '';
          if (!url.includes(`v=${SW_VERSION}`)) {
            await reg.unregister().catch(() => {});
          }
        }
        // Step 2: register the current version
        await navigator.serviceWorker.register(`/service-worker.js?v=${SW_VERSION}`);
      } catch {
        // SW is an enhancement — a failed registration never breaks the app
      }
    };

    const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(() => { register(); });
    } else {
      window.setTimeout(register, 1500);
    }
  }, []);
  return null;
}
