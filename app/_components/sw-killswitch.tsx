'use client';

import { useEffect } from 'react';

// Registers the offline-shell service worker (public/service-worker.js).
// Deferred to browser idle time so it doesn't compete with the critical
// first-paint path on slow terminals — every ms of main-thread work during
// startup directly delays when the UI becomes interactive on a Sunmi V2 Pro.
export function SwKillswitch() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register('/service-worker.js?v=shell-2')
        .catch(() => { /* nothing to do — SW will re-attempt next load */ });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(register);
    } else {
      window.setTimeout(register, 1500);
    }
  }, []);
  return null;
}
