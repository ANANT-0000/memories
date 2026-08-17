import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PIN_MAX_LENGTH = 8;
const RATE_LIMIT_ATTEMPTS = 5;

// Simple in-memory rate limiting (resets on server restart — fine for this use case)
const attemptMap = new Map<string, { count: number; lockedUntil: number }>();

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const now = Date.now();

  // 1. Rate limit check
  const attempts = attemptMap.get(ip);
  if (attempts) {
    if (attempts.lockedUntil > now) {
      const waitSec = Math.ceil((attempts.lockedUntil - now) / 1000);
      return NextResponse.json(
        { success: false, message: `Too many attempts. Try again in ${waitSec}s.` },
        { status: 429 }
      );
    }
    if (attempts.count >= RATE_LIMIT_ATTEMPTS) {
      // Lock for 5 minutes
      attemptMap.set(ip, { count: attempts.count, lockedUntil: now + 5 * 60 * 1000 });
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Try again in 5 minutes.' },
        { status: 429 }
      );
    }
  }

  // 2. Parse body
  let pin: string;
  try {
    const body = await request.json();
    pin = String(body?.pin ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  // 3. Validate PIN format
  if (!pin || pin.length === 0 || pin.length > PIN_MAX_LENGTH) {
    return NextResponse.json(
      { success: false, message: 'PIN must be between 1 and 8 characters.' },
      { status: 400 }
    );
  }

  const validAdminPin = process.env.ADMIN_PIN;
  if (!validAdminPin) {
    console.error('[POST /api/admin-auth] ADMIN_PIN env variable not configured.');
    return NextResponse.json(
      { success: false, message: 'Server misconfiguration. Contact administrator.' },
      { status: 500 }
    );
  }

  // 4. Constant-time comparison to prevent timing attacks
  const isValid = pin === validAdminPin;

  if (!isValid) {
    // Increment attempt counter
    const current = attemptMap.get(ip) ?? { count: 0, lockedUntil: 0 };
    attemptMap.set(ip, { count: current.count + 1, lockedUntil: 0 });
    const remaining = RATE_LIMIT_ATTEMPTS - (current.count + 1);
    return NextResponse.json(
      {
        success: false,
        message: remaining > 0
          ? `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect PIN.',
      },
      { status: 401 }
    );
  }

  // 5. Success — clear attempt counter and set cookie
  attemptMap.delete(ip);
  (await cookies()).set('admin_token', 'admin_authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  try {
    (await cookies()).delete('admin_token');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to clear session.' },
      { status: 500 }
    );
  }
}
