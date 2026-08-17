import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import type { Metadata as SharpMetadata } from 'sharp';

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
];
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── GET /api/images — public, no auth required ───────────────────────────────
export async function GET() {
  try {
    const supabase = getAdminSupabase();

    // 1. Fetch images from DB
    const { data: images, error: dbError } = await supabase
      .from("gallery_images")
      .select("id, url, sort_order, created_at")
      .order("sort_order", { ascending: true });

    if (dbError) {
      console.error("[GET /api/images] DB error:", dbError.message);
      return NextResponse.json(
        { success: false, message: "Failed to fetch images from database." },
        { status: 500 },
      );
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ success: true, images: [] });
    }

    // 2. Generate signed URLs (5 min expiry) — private bucket
    const filePaths = images.map((img) => img.url);
    const { data: signedUrls, error: storageError } = await supabase.storage
      .from("gallery_bucket")
      .createSignedUrls(filePaths, 60 * 5);

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

    // 3. Map signed URLs back — skip any that failed to sign
    const imagesWithUrls = images
      .map((img, i) => {
        const signedUrl = signedUrls?.[i]?.signedUrl;
        if (!signedUrl) return null; // skip broken entries
        return { ...img, url: signedUrl };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, images: imagesWithUrls });
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

    // 3. Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, GIF, WEBP, AVIF.`,
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

    // 7. Compress to WebP
    // PNG/GIF → lossless (preserves transparency)
    // JPG/HEIC/others → near-lossless (imperceptible quality loss, ~40% smaller)
    const isLosslessSource = ["png", "gif", "svg"].includes(
      metadata.format ?? "",
    );
    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(rawBuffer)
        .webp(
          isLosslessSource
            ? { lossless: true }
            : { nearLossless: true, quality: 100 },
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
      .slice(0, 80); // cap filename length
    const storagePath = `images/${Date.now()}-${baseName}.webp`;

    const supabase = getAdminSupabase();

    // 9. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("gallery_bucket")
      .upload(storagePath, compressedBuffer, {
        contentType: "image/webp",
        upsert: false,
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
      .select("id, url, sort_order, created_at")
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
