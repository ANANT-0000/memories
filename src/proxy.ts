import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token');
  const { pathname } = request.nextUrl;

  // ── Admin protection: /admin/* requires admin_token ───────────────────────
  // Gallery (/) is protected purely by in-memory React state — no cookies needed.
  if (!adminToken && pathname.startsWith('/admin') && pathname !== '/admin/lock') {
    return NextResponse.redirect(new URL('/admin/lock', request.url));
  }

  if (adminToken && pathname === '/admin/lock') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png).*)'],
};
