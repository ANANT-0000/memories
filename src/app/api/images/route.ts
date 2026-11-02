import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import type { Metadata as SharpMetadata } from 'sharp';
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env/server';
import {
  isAllowedImage,
  MAX_DIMENSION,
  MAX_IMAGE_SIZE_BYTES,
  MAX_INPUT_PIXELS,
} from '@/lib/validations/image';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Restrict Sharp concurrency to 1 to protect memory on Vercel serverless instances during burst uploads
sharp.concurrency(1);

// ─── In-process signed-URL cache ─────────────────────────────────────────────
// 24 hours signed URL TTL prevents premature 403s on Vercel CDN cached images
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL_SEC = 60 * 60 * 24; // 24 hours
const CACHE_GRACE_MS = 60_000;           // treat cached URL as stale 1 min early

function getCachedUrl(path: string): string | null {
  const entry = urlCache.get(path);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt - CACHE_GRACE_MS) {
    urlCache.delete(path);
    return null;
  }
  return entry.url;
}

function setCachedUrl(path: string, url: string) {
  urlCache.set(path, {
    url,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
  });
}

// ─── GET /api/images — protected, PIN required via Bearer token ────────────
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const bearerPin = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const validPin = serverEnv.GALLERY_PIN;

  // Also accept admin_token cookie (for admin panel access)
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token');

  if (bearerPin !== validPin && !adminToken) {
    logger.warn('Unauthorized access attempt to /api/images', {
      hasBearer: Boolean(bearerPin),
      hasAdminCookie: Boolean(adminToken),
    });
    return NextResponse.json(
      { success: false, message: 'Authentication required.' },
      { status: 401 }
    );
  }

  try {
    const supabase = getAdminSupabase();

    // 1. Fetch image records from DB (only what we need)
    const { data: images, error: dbError } = await supabase
      .from('gallery_images')
      .select('id, url, sort_order')
      .order('sort_order', { ascending: true });

    if (dbError) {
      logger.error('Database query failed in GET /api/images', dbError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch images from database.' },
        { status: 500 }
      );
    }

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: true, images: [] },
        {
          headers: {
            'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
          },
        }
      );
    }

    // 2. Split into cached vs needs-new-signing
    const needsSigning: { path: string; index: number }[] = [];
    const resolved: (string | null)[] = images.map((img, i) => {
      const cached = getCachedUrl(img.url);
      if (cached) return cached;
      needsSigning.push({ path: img.url, index: i });
      return null;
    });

    // 3. Batch-sign only the uncached paths (one round trip)
    if (needsSigning.length > 0) {
      const { data: signedUrls, error: storageError } = await supabase.storage
        .from('gallery_bucket')
        .createSignedUrls(
          needsSigning.map((n) => n.path),
          SIGNED_URL_TTL_SEC
        );

      if (storageError) {
        logger.error('Storage signed URL generation failed in GET /api/images', storageError);
        return NextResponse.json(
          { success: false, message: 'Failed to generate secure image URLs.' },
          { status: 500 }
        );
      }

      signedUrls?.forEach((s, i) => {
        const item = needsSigning[i];
        if (s.signedUrl && item) {
          const { path, index } = item;
          setCachedUrl(path, s.signedUrl);
          resolved[index] = s.signedUrl;
        }
      });
    }

    // 4. Build final list — skip any that failed to sign
    const imagesWithUrls = images
      .map((img, i) => {
        const url = resolved[i];
        if (!url) return null;
        return { id: img.id, url, sort_order: img.sort_order };
      })
      .filter(Boolean);

    return NextResponse.json(
      { success: true, images: imagesWithUrls },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    logger.error('Unexpected error in GET /api/images', err);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

const directRegistrationSchema = z.object({
  storagePath: z.string().trim().min(5).max(250).startsWith('images/'),
  savedPercent: z.number().optional(),
});

// ─── POST /api/images — admin only, handles both direct registration & upload ──
export async function POST(request: Request) {
  const reqStart = Date.now();

  // 1. Admin auth check
  const adminToken = (await cookies()).get('admin_token');
  if (!adminToken) {
    logger.warn('Forbidden upload attempt without admin token');
    return NextResponse.json(
      { success: false, message: 'Admin authentication required.' },
      { status: 403 }
    );
  }

  const contentType = request.headers.get('content-type') || '';

  // ── Mode A: Direct upload registration (bypasses Vercel 4.5MB payload limit) ──
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      const parsed = directRegistrationSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: 'Invalid storagePath provided.' },
          { status: 400 }
        );
      }

      const { storagePath, savedPercent } = parsed.data;
      const supabase = getAdminSupabase();

      // Insert record into DB with microsecond-level collision-safe sort order
      const safeSortOrder = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const { data: insertData, error: dbError } = await supabase
        .from('gallery_images')
        .insert({ url: storagePath, sort_order: safeSortOrder })
        .select('id, url, sort_order')
        .single();

      if (dbError) {
        await supabase.storage.from('gallery_bucket').remove([storagePath]);
        logger.error('Direct upload DB insert failed, rolled back storage', dbError, {
          storagePath,
        });
        return NextResponse.json(
          { success: false, message: 'Database insert failed. Upload has been rolled back.' },
          { status: 500 }
        );
      }

      const durationMs = Date.now() - reqStart;
      logger.info('Direct image upload registered successfully', {
        imageId: insertData.id,
        storagePath,
        savedPercent,
        durationMs,
      });

      return NextResponse.json({
        success: true,
        image: insertData,
        compression: { savedPercent },
      });
    } catch (directErr) {
      logger.error('Unhandled exception during direct upload registration', directErr);
      return NextResponse.json(
        { success: false, message: 'Failed to register image upload.' },
        { status: 500 }
      );
    }
  }

  // ── Mode B: Multipart Form Upload Fallback (for small files < 4.5MB) ─────────
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'No file was provided.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'unnamed-file';
    const fileType = file.type || '';

    if (!isAllowedImage(fileName, fileType)) {
      logger.warn('Upload rejected: unsupported file format', { fileName, fileType });
      return NextResponse.json(
        { success: false, message: 'Unsupported file type. Please upload images only.' },
        { status: 415 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      logger.warn('Upload rejected: file size exceeds maximum limit', {
        fileName,
        sizeBytes: file.size,
        maxBytes: MAX_IMAGE_SIZE_BYTES,
      });
      return NextResponse.json(
        {
          success: false,
          message: `File too large. Maximum allowed size is ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`,
        },
        { status: 413 }
      );
    }

    let rawBuffer: Buffer;
    try {
      rawBuffer = Buffer.from(await file.arrayBuffer());
    } catch (readErr) {
      logger.error('Failed to read uploaded file buffer', readErr, { fileName });
      return NextResponse.json(
        { success: false, message: 'Failed to read file data. The file may be corrupt.' },
        { status: 400 }
      );
    }

    let metadata: SharpMetadata;
    try {
      metadata = await sharp(rawBuffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error',
      }).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Image dimensions could not be determined');
      }
    } catch (metaErr) {
      logger.error('Corrupt image or decompression bomb rejected', metaErr, { fileName });
      return NextResponse.json(
        { success: false, message: 'File is not a valid image or is corrupt.' },
        { status: 400 }
      );
    }

    const originalSizeKB = Math.round(rawBuffer.byteLength / 1024);
    const isLosslessSource = ['png', 'gif', 'svg'].includes(metadata.format ?? '');
    let pipeline = sharp(rawBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'error',
    }).rotate();

    const longestEdge = Math.max(metadata.width, metadata.height);
    if (longestEdge > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await pipeline
        .webp(
          isLosslessSource
            ? { lossless: true, effort: 4 }
            : { quality: 92, effort: 4, smartSubsample: true }
        )
        .toBuffer();
    } catch (compErr) {
      logger.error('Sharp image compression failed', compErr, { fileName });
      return NextResponse.json(
        { success: false, message: 'Image compression failed.' },
        { status: 500 }
      );
    }

    const compressedSizeKB = Math.round(compressedBuffer.byteLength / 1024);
    const savedPercent = Math.max(
      0,
      Math.round((1 - compressedBuffer.byteLength / rawBuffer.byteLength) * 100)
    );

    const baseName = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 80);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `images/${uniqueSuffix}-${baseName}.webp`;

    const supabase = getAdminSupabase();

    const { error: uploadError } = await supabase.storage
      .from('gallery_bucket')
      .upload(storagePath, compressedBuffer, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      logger.error('Supabase storage upload error', uploadError, { fileName, storagePath });
      return NextResponse.json(
        { success: false, message: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const safeSortOrder = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const { data: insertData, error: dbError } = await supabase
      .from('gallery_images')
      .insert({ url: storagePath, sort_order: safeSortOrder })
      .select('id, url, sort_order')
      .single();

    if (dbError) {
      await supabase.storage.from('gallery_bucket').remove([storagePath]);
      logger.error('Database insert failed, storage rolled back', dbError, {
        fileName,
        storagePath,
      });
      return NextResponse.json(
        { success: false, message: 'Database insert failed. Uploaded file has been removed.' },
        { status: 500 }
      );
    }

    const durationMs = Date.now() - reqStart;
    logger.info('Image uploaded via fallback and processed successfully', {
      imageId: insertData.id,
      fileName,
      originalSizeKB,
      compressedSizeKB,
      savedPercent,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      image: insertData,
      compression: { originalSizeKB, compressedSizeKB, savedPercent },
    });
  } catch (err) {
    logger.error('Unhandled exception during fallback image upload', err);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred during upload.' },
      { status: 500 }
    );
  }
}
