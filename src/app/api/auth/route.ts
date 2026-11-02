import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/auth — verify PIN for the in-memory session
export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const validPin = serverEnv.GALLERY_PIN;

    if (pin === validPin) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid PIN' }, { status: 401 });
  } catch (err: unknown) {
    logger.warn('Bad request in /api/auth', { error: err });
    return NextResponse.json({ success: false, message: 'Bad request' }, { status: 400 });
  }
}
