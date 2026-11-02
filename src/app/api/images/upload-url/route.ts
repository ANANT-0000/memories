import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { findDuplicateMatch } from '@/lib/utils/similarity';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  filename: z.string().trim().min(1).max(150),
  contentType: z.string().trim().max(100).optional(),
  force: z.boolean().optional().default(false),
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

    const { filename, force } = parsed.data;
    const supabase = getAdminSupabase();

    // 2. Validate duplicates against existing database records (unless admin explicitly forced)
    if (!force) {
      const { data: existingRecords } = await supabase
        .from('gallery_images')
        .select('id, url');

      const existingUrls = (existingRecords ?? []).map((r) => r.url);
      const duplicateCheck = findDuplicateMatch(filename, existingUrls, 0.90);

      if (duplicateCheck.isDuplicate && duplicateCheck.matchedUrl) {
        // Create quick signed thumbnail URL so the admin gets an instant visual preview
        const { data: signedPreview } = await supabase.storage
          .from('gallery_bucket')
          .createSignedUrl(duplicateCheck.matchedUrl, 300);

        logger.info('Duplicate candidate detected in upload-url', {
          filename,
          matchedUrl: duplicateCheck.matchedUrl,
          similarity: duplicateCheck.similarity,
        });

        return NextResponse.json(
          {
            success: false,
            duplicate: true,
            similarity: duplicateCheck.similarity,
            matchedUrl: duplicateCheck.matchedUrl,
            matchedPreviewUrl: signedPreview?.signedUrl ?? null,
            matchedBaseName: duplicateCheck.matchedBaseName,
            message: `A similar file "${duplicateCheck.matchedBaseName}" is already in the gallery (${Math.round(duplicateCheck.similarity * 100)}% match).`,
          },
          { status: 409 }
        );
      }
    }

    // 3. Build unique, safe storage path
    const baseName = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 80) || 'image';
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `images/${uniqueSuffix}-${baseName}.webp`;

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
