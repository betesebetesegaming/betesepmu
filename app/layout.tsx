import type { Metadata, Viewport } from 'next';
import { getPublicEnvForInjection } from '@/lib/env/publicConfig';
import { SwKillswitch } from './_components/sw-killswitch';
import './globals.css';

export const metadata: Metadata = {
  title: 'Betese PMU',
  description: 'Fast horse racing betting terminal system',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#008000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publicEnv = getPublicEnvForInjection();
  const envScript = `window.__BETESE_ENV__=${JSON.stringify(publicEnv)};`;

  // Hide the splash as soon as the React app commits — runs once on page
  // load. Deferred to two RAFs so we wait through the first AppClient
  // render before the fade kicks in.
  const splashHideScript = `(function(){var s=document.getElementById('betese-splash');if(!s)return;var hide=function(){if(s&&s.parentNode){s.style.transition='opacity .2s';s.style.opacity='0';setTimeout(function(){try{s.remove()}catch(e){}},220)}};if(document.readyState==='complete'){requestAnimationFrame(function(){requestAnimationFrame(hide)})}else{window.addEventListener('load',function(){requestAnimationFrame(function(){requestAnimationFrame(hide)})})}setTimeout(hide,6000);})();`;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
      </head>
      <body className="bg-gray-100">
        {/* Server-rendered splash. Lives in the very first HTML response so
            the Sunmi terminal paints the brand colour and logo before any
            JS has downloaded. Rendered as plain JSX (not raw HTML) so React
            and the browser produce byte-identical style attributes and
            hydration stays clean. */}
        <div
          id="betese-splash"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#008000',
            color: '#ffffff',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
            zIndex: 2147483646,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Betese PMU"
            width={120}
            height={120}
            style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 20 }}
          />
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 2 }}>BETESE PMU</div>
          <div className="betese-splash-spinner" />
        </div>
        <SwKillswitch />
        {children}
        <script dangerouslySetInnerHTML={{ __html: splashHideScript }} />
      </body>
    </html>
  );
}
