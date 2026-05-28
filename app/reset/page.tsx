'use client';

import { useEffect, useState } from 'react';

// Recovery page for users stuck behind the legacy Vite-era service worker.
// Visit /reset once: clears SW registrations, caches, and storage, then
// redirects home. Linked from support docs as the escape hatch when the
// kill-switch SW hasn't propagated yet.
export default function ResetPage() {
  const [status, setStatus] = useState('Clearing site data…');

  useEffect(() => {
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (typeof caches !== 'undefined') {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        try { localStorage.clear(); } catch { /* sandboxed iframe etc. */ }
        try { sessionStorage.clear(); } catch { /* same */ }
        setStatus('Done. Reloading…');
      } catch (err) {
        setStatus(`Reset failed: ${(err as Error).message}. Reloading anyway…`);
      } finally {
        setTimeout(() => { window.location.replace('/'); }, 600);
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center text-gray-600 p-6 text-center">
      {status}
    </div>
  );
}
