import { NextResponse } from 'next/server';

// POST /api/auth — verify PIN for the in-memory session
export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const validPin = process.env.GALLERY_PIN || '1234';

    if (pin === validPin) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid PIN' }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: 'Bad request' }, { status: 400 });
  }
}
