'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), {
  ssr: false,
  loading: () => <Splash />,
});

// Branded splash shown while the App chunk + Firebase SDK download and parse.
// Renders from the same JS module that owns the dynamic import, so it appears
// the moment Next.js commits the Suspense fallback — well before the betting
// terminal has finished initialising.
function Splash() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#008000',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      }}
    >
      <img
        src="/logo.png"
        alt="Betese PMU"
        width={120}
        height={120}
        style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 20 }}
      />
      <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 2 }}>BETESE PMU</div>
      <div
        style={{
          marginTop: 18,
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.35)',
          borderTopColor: '#ffffff',
          animation: 'betese-splash-spin 0.9s linear infinite',
        }}
      />
      <style>{`@keyframes betese-splash-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function AppClient() {
  return <App />;
}
