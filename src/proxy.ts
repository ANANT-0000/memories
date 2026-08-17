import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token');
  const { pathname } = request.nextUrl;

  // /admin/* requires admin_token, redirect to lock screen if missing
  if (!adminToken && pathname.startsWith('/admin') && pathname !== '/admin/lock') {
    return NextResponse.redirect(new URL('/admin/lock', request.url));
  }

  // Already have admin token → skip lock screen
  if (adminToken && pathname === '/admin/lock') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
