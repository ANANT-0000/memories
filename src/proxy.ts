import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token');

  // If user tries to access /gallery or /admin without a cookie
  if (!token && (request.nextUrl.pathname.startsWith('/gallery') || request.nextUrl.pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user tries to access root (/) but already has a cookie
  if (token && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/gallery', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
