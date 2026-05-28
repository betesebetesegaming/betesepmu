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

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
      </head>
      <body className="bg-gray-100">
        <SwKillswitch />
        {children}
      </body>
    </html>
  );
}
