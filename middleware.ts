import { NextRequest, NextResponse } from 'next/server';

// One-time recovery for users still carrying the legacy Vite-era service
// worker that served blank pages after the Next.js migration.
//
// On the user's next navigation we set `Clear-Site-Data: "cache", "storage"`
// which forces the browser to unregister all service workers and drop their
// caches/IndexedDB/localStorage. We then drop a long-lived cookie so the
// header is only sent once per browser — subsequent visits are untouched
// and keep their session.
//
// Bump SW_RESET_VERSION if we ever need to force another sweep.
const SW_RESET_COOKIE = 'sw_reset';
const SW_RESET_VERSION = 'v1';

export function middleware(request: NextRequest) {
  if (request.cookies.get(SW_RESET_COOKIE)?.value === SW_RESET_VERSION) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  // "storage" unregisters service workers and clears IndexedDB/localStorage.
  // We intentionally omit "cookies" so the marker cookie below survives.
  response.headers.set('Clear-Site-Data', '"cache", "storage"');
  response.cookies.set({
    name: SW_RESET_COOKIE,
    value: SW_RESET_VERSION,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  // Only run on top-level navigations, not every static asset request.
  // _next/static, _next/image, the kill-switch SW itself, and the manifest
  // are excluded so they aren't slowed down or affected.
  matcher: ['/((?!_next/static|_next/image|service-worker.js|manifest.json|icon.png|favicon.ico|.*\\..*).*)'],
};
