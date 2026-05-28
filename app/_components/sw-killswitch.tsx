'use client';

import { useEffect } from 'react';

// Re-registers /service-worker.js so existing browsers fetch the kill-switch
// SW and drop the stale Vite-era cache that was serving blank pages.
// Safe to keep indefinitely — the SW unregisters itself on activate.
export function SwKillswitch() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/service-worker.js?v=killswitch-1')
      .catch(() => { /* nothing to do — kill-switch will re-attempt next load */ });
  }, []);
  return null;
}
