import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import type { Metadata as SharpMetadata } from 'sharp';

// ─── Max output dimension (longest edge) ────────────────────────────────────
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// 1600px covers 2× retina on all phones (up to ~800px wide screens).
// A 4K phone photo resized to 1600px is visually identical on mobile.
const MAX_DIMENSION = 1600;

// ─── In-process signed-URL cache ─────────────────────────────────────────────
// Key: storage path   Value: { url, expiresAt (ms epoch) }
// This avoids regenerating signed URLs on every page load.
// Safe for a single-admin gallery — no multi-tenant isolation needed.
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL_SEC = 60 * 55; // 55 min — well inside 60 min expiry
const CACHE_GRACE_MS = 60_000;      // treat cached URL as stale 1 min early

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
  const validPin = process.env.GALLERY_PIN || '1234';

  // Also accept admin_token cookie (for admin panel access)
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token');

  if (bearerPin !== validPin && !adminToken) {
    return NextResponse.json(
      { success: false, message: 'Authentication required.' },
      { status: 401 }
    );
  }

  try {
    const supabase = getAdminSupabase();

    // 1. Fetch image records from DB (only what we need)
    const { data: images, error: dbError } = await supabase
      .from("gallery_images")
      .select("id, url, sort_order")
      .order("sort_order", { ascending: true });

    if (dbError) {
      console.error("[GET /api/images] DB error:", dbError.message);
      return NextResponse.json(
        { success: false, message: "Failed to fetch images from database." },
        { status: 500 },
      );
    }

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: true, images: [] },
        {
          headers: {
            // Allow CDN/browser to cache an empty response briefly
            "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
          },
        },
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
        .from("gallery_bucket")
        .createSignedUrls(
          needsSigning.map((n) => n.path),
          SIGNED_URL_TTL_SEC,
        );

      if (storageError) {
        console.error(
          "[GET /api/images] Storage signed URL error:",
          storageError.message,
        );
        return NextResponse.json(
          { success: false, message: "Failed to generate secure image URLs." },
          { status: 500 },
        );
      }

      signedUrls?.forEach((s, i) => {
        if (s.signedUrl) {
          const { path, index } = needsSigning[i];
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
          // Tell CDN/browser: fresh for 30s, serve stale for 60s while revalidating
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    console.error("[GET /api/images] Unexpected error:", err);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

// ─── POST /api/images — admin only, uploads a single image ────────────────────
export async function POST(request: Request) {
  // 1. Admin auth check
  const adminToken = (await cookies()).get("admin_token");
  if (!adminToken) {
    return NextResponse.json(
      { success: false, message: "Admin authentication required." },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    // 2. Validate file presence
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, message: "No file was provided." },
        { status: 400 },
      );
    }

    // 3. Validate file type (allow any image/ or .heic/.heif extensions)
    // Browsers often fail to assign image/heic MIME types to .HEIC files.
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const ext = fileName.match(/\.[0-9a-z]+$/)?.[0] || "";
    const validExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic", ".heif", ".tiff", ".tif", ".bmp", ".svg"];
    const isImage = fileType.startsWith("image/") || validExts.includes(ext);

    if (!isImage) {
      return NextResponse.json(
        {
          success: false,
          message: `Unsupported file type. Please upload images only.`,
        },
        { status: 415 },
      );
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`,
        },
        { status: 413 },
      );
    }

    // 5. Read raw buffer
    let rawBuffer: Buffer;
    try {
      rawBuffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to read file data. The file may be corrupt.",
        },
        { status: 400 },
      );
    }

    // 6. Validate it's a real image (sharp will throw if not)
    let metadata: SharpMetadata;
    try {
      metadata = await sharp(rawBuffer).metadata();
      if (!metadata.width || !metadata.height)
        throw new Error("Invalid dimensions");
    } catch {
      return NextResponse.json(
        { success: false, message: "File is not a valid image or is corrupt." },
        { status: 400 },
      );
    }

    const originalSizeKB = Math.round(rawBuffer.byteLength / 1024);

    // 7. Compress to WebP with real size reduction
    // Strategy:
    //   • Cap longest edge at MAX_DIMENSION (2048px) — phones shoot 4K+, we don't need that
    //   • PNG/GIF/SVG → lossless WebP (preserves transparency, already compressed PNGs)
    //   • Everything else → quality 85 WebP (imperceptible loss, ~60-70% smaller than JPEG)
    const isLosslessSource = ["png", "gif", "svg"].includes(
      metadata.format ?? "",
    );

    // Build the sharp pipeline
    let pipeline = sharp(rawBuffer).rotate(); // auto-rotate from EXIF

    // Resize only if larger than MAX_DIMENSION on either axis
    const longestEdge = Math.max(metadata.width, metadata.height);
    if (longestEdge > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",       // preserve aspect ratio
        withoutEnlargement: true,
      });
    }

    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await pipeline
        .webp(
          isLosslessSource
            ? { lossless: true, effort: 4 }
            // quality 92 = visually lossless on mobile screens (vs 85 which
            // can show subtle banding on high-contrast edges at 100% zoom).
            // Size savings come primarily from the resize step above.
            : { quality: 92, effort: 4, smartSubsample: true },
        )
        .toBuffer();
    } catch (err) {
      console.error("[POST /api/images] Compression error:", err);
      return NextResponse.json(
        { success: false, message: "Image compression failed." },
        { status: 500 },
      );
    }

    const compressedSizeKB = Math.round(compressedBuffer.byteLength / 1024);
    const savedPercent = Math.max(
      0,
      Math.round(
        (1 - compressedBuffer.byteLength / rawBuffer.byteLength) * 100,
      ),
    );
    console.log(
      `[upload] ${file.name}: ${originalSizeKB}KB → ${compressedSizeKB}KB WebP (saved ${savedPercent}%)`,
    );

    // 8. Build storage path
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 80);
    const storagePath = `images/${Date.now()}-${baseName}.webp`;

    const supabase = getAdminSupabase();

    // 9. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("gallery_bucket")
      .upload(storagePath, compressedBuffer, {
        contentType: "image/webp",
        upsert: false,
        // Let Supabase CDN cache the file at the edge
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error(
        "[POST /api/images] Storage upload error:",
        uploadError.message,
      );
      return NextResponse.json(
        {
          success: false,
          message: `Storage upload failed: ${uploadError.message}`,
        },
        { status: 500 },
      );
    }

    // 10. Insert record into DB
    const { data: insertData, error: dbError } = await supabase
      .from("gallery_images")
      .insert({ url: storagePath, sort_order: Date.now() })
      .select("id, url, sort_order")
      .single();

    if (dbError) {
      // Rollback: delete the uploaded file since DB insert failed
      await supabase.storage.from("gallery_bucket").remove([storagePath]);
      console.error(
        "[POST /api/images] DB insert error (storage rolled back):",
        dbError.message,
      );
      return NextResponse.json(
        {
          success: false,
          message: "Database insert failed. Uploaded file has been removed.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      image: insertData,
      compression: { originalSizeKB, compressedSizeKB, savedPercent },
    });
  } catch (err) {
    console.error("[POST /api/images] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred during upload.",
      },
      { status: 500 },
    );
  }
}
