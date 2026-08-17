import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  const adminToken = request.cookies.get('admin_token');
  const { pathname } = request.nextUrl;

  // 1. No gallery token → send to PIN screen for /gallery
  if (!token && pathname.startsWith('/gallery')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. No admin token → send to admin lock screen (not back to /, they may be logged in to gallery)
  if (!adminToken && pathname.startsWith('/admin') && pathname !== '/admin/lock') {
    return NextResponse.redirect(new URL('/admin/lock', request.url));
  }

  // 3. Already have admin token → skip the lock screen
  if (adminToken && pathname === '/admin/lock') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // 4. Already have gallery token → skip the gallery PIN screen
  if (token && pathname === '/') {
    return NextResponse.redirect(new URL('/gallery', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
