import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const validPin = process.env.GALLERY_PIN || '1234';

    if (pin === validPin) {
      // Create session cookie
      (await cookies()).set('auth_token', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid PIN' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Bad request' }, { status: 400 });
  }
}
