import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const validAdminPin = process.env.ADMIN_PIN;

    if (!validAdminPin) {
      return NextResponse.json({ success: false, message: 'Admin PIN not configured' }, { status: 500 });
    }

    if (pin === validAdminPin) {
      (await cookies()).set('admin_token', 'admin_authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid admin PIN' }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: 'Bad request' }, { status: 400 });
  }
}

export async function DELETE() {
  // Logout: clear the admin token
  (await cookies()).delete('admin_token');
  return NextResponse.json({ success: true });
}
