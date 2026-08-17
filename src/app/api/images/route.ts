import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import sharp from 'sharp';

export async function GET(request: Request) {
  const token = (await cookies()).get('auth_token');
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminSupabase();
    const { data: images, error: dbError } = await supabase
      .from('gallery_images')
      .select('*')
      .order('sort_order', { ascending: true });

    if (dbError) {
      console.error('Database Error:', dbError);
      return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ success: true, images: [] });
    }

    const filePaths = images.map(img => img.url);

    const { data: signedUrls, error: storageError } = await supabase
      .storage
      .from('gallery_bucket')
      .createSignedUrls(filePaths, 60 * 5); // 5 minutes expiration

    if (storageError || !signedUrls) {
      console.error('Storage Error:', storageError);
      return NextResponse.json({ success: false, message: 'Failed to generate signed URLs' }, { status: 500 });
    }

    const imagesWithSignedUrls = images.map((img, index) => ({
      ...img,
      url: signedUrls[index]?.signedUrl || img.url
    }));

    return NextResponse.json({ success: true, images: imagesWithSignedUrls });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Require BOTH gallery auth and admin auth for uploads
  const adminToken = (await cookies()).get('admin_token');
  if (!adminToken) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, message: 'Only image files are allowed' }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // ─── Compression layer ────────────────────────────────────────────────────
    // Read image metadata to decide compression strategy
    const metadata = await sharp(rawBuffer).metadata();
    const originalSizeKB = Math.round(rawBuffer.byteLength / 1024);

    // PNG/GIF sources → lossless WebP (perfect pixel quality, preserves transparency)
    // JPG/HEIC/others → near-lossless WebP (quality 100, ~40% smaller, zero visible loss)
    const isLosslessSource = ['png', 'gif', 'svg'].includes(metadata.format ?? '');

    const compressedBuffer = await sharp(rawBuffer)
      .webp(
        isLosslessSource
          ? { lossless: true }
          : { nearLossless: true, quality: 100 }
      )
      .toBuffer();

    const compressedSizeKB = Math.round(compressedBuffer.byteLength / 1024);
    const saving = Math.round((1 - compressedBuffer.byteLength / rawBuffer.byteLength) * 100);

    console.log(
      `[upload] ${file.name}: ${originalSizeKB}KB → ${compressedSizeKB}KB WebP (saved ${saving >= 0 ? saving : 0}%)`
    );
    // ─────────────────────────────────────────────────────────────────────────

    // Always store as .webp
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '-');
    const fileName = `${Date.now()}-${baseName}.webp`;
    const storagePath = `images/${fileName}`;

    const supabase = getAdminSupabase();

    // 1. Upload compressed WebP to Storage
    const { error: uploadError } = await supabase
      .storage
      .from('gallery_bucket')
      .upload(storagePath, compressedBuffer, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      return NextResponse.json({ success: false, message: 'Storage upload failed' }, { status: 500 });
    }

    // 2. Insert path into Database
    const { data: insertData, error: dbError } = await supabase
      .from('gallery_images')
      .insert({
        url: storagePath,
        sort_order: Date.now(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB Insert Error:', dbError);
      return NextResponse.json({ success: false, message: 'Database insert failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      image: insertData,
      compression: { originalSizeKB, compressedSizeKB, savedPercent: Math.max(0, saving) },
    });

  } catch (error) {
    console.error('Upload POST Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
