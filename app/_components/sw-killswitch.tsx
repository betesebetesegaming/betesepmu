'use client';

import { useEffect } from 'react';

// Registers the offline-shell service worker so the second-and-later launch
// of the app reads its JS/CSS from cache (instant load on slow terminal
// connections), while every Firebase / API call still hits the network.
// The version tag forces Chrome to refetch the SW file when we change it.
export function SwKillswitch() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/service-worker.js?v=shell-2')
      .catch(() => { /* nothing to do — SW will re-attempt next load */ });
  }, []);
  return null;
}
