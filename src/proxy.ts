import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token');
  const authToken = request.cookies.get('auth_token');
  const { pathname } = request.nextUrl;

  // ── Gallery protection: / and /gallery require auth_token ─────────────────
  const isGalleryRoute =
    pathname === '/' || pathname.startsWith('/gallery');

  if (isGalleryRoute && !authToken) {
    return NextResponse.redirect(new URL('/lock', request.url));
  }

  // NOTE: /lock has NO redirect-away rule. PinScreen clears the old cookie
  // on mount, so the user always sees the PIN screen when they land there.

  // ── Admin protection: /admin/* requires admin_token ───────────────────────
  if (!adminToken && pathname.startsWith('/admin') && pathname !== '/admin/lock') {
    return NextResponse.redirect(new URL('/admin/lock', request.url));
  }

  if (adminToken && pathname === '/admin/lock') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png).*)'],
};
