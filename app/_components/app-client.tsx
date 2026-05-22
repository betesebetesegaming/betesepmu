'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-gray-600">
      Loading Betese PMU…
    </div>
  ),
});

export function AppClient() {
  return <App />;
}
