import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  filename: z.string().trim().min(1).max(150),
  contentType: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  // 1. Admin auth check
  const adminToken = (await cookies()).get('admin_token');
  if (!adminToken) {
    logger.warn('Forbidden attempt to request upload-url without admin token');
    return NextResponse.json(
      { success: false, message: 'Admin authentication required.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: filename is required.' },
        { status: 400 }
      );
    }

    const { filename } = parsed.data;

    // 2. Build unique, safe storage path
    const baseName = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 80) || 'image';
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `images/${uniqueSuffix}-${baseName}.webp`;

    const supabase = getAdminSupabase();

    // 3. Create signed upload URL in Supabase Storage (bypasses Vercel 4.5MB payload limit)
    const { data, error } = await supabase.storage
      .from('gallery_bucket')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      logger.error('Failed to create Supabase signed upload URL', error, { storagePath });
      return NextResponse.json(
        { success: false, message: 'Failed to generate secure upload credentials.' },
        { status: 500 }
      );
    }

    logger.info('Generated presigned upload URL for direct client-to-storage stream', {
      storagePath,
      filename,
    });

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
    });
  } catch (err) {
    logger.error('Unexpected error in POST /api/images/upload-url', err);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
