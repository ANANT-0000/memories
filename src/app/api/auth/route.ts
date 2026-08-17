import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST /api/auth — verify PIN and set session cookie
export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const validPin = process.env.GALLERY_PIN || '1234';

    if (pin === validPin) {
      // Session cookie — no maxAge/expires so it dies when the browser process closes.
      // The client-side sessionStorage flag handles tab-close detection for browsers
      // that restore sessions (iOS Safari, Chrome with "Continue where you left off").
      (await cookies()).set('auth_token', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict',
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid PIN' }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: 'Bad request' }, { status: 400 });
  }
}

// DELETE /api/auth — clear the gallery session cookie.
// Called by the client when sessionStorage is empty (tab was closed and reopened).
export async function DELETE() {
  (await cookies()).set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'strict',
    maxAge: 0, // immediately expire
  });
  return NextResponse.json({ success: true });
}
