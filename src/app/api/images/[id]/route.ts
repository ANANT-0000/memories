import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Admin auth check
  const adminToken = (await cookies()).get('admin_token');
  if (!adminToken) {
    return NextResponse.json(
      { success: false, message: 'Admin authentication required.' },
      { status: 403 }
    );
  }

  // 2. Validate id param
  const { id } = await params;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json(
      { success: false, message: 'Invalid image ID.' },
      { status: 400 }
    );
  }

  try {
    const supabase = getAdminSupabase();

    // 3. Fetch the image record first to get the storage path
    const { data: image, error: fetchError } = await supabase
      .from('gallery_images')
      .select('id, url')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      console.error('[DELETE /api/images/[id]] Fetch error:', fetchError?.message);
      return NextResponse.json(
        { success: false, message: 'Image not found in database.' },
        { status: 404 }
      );
    }

    const storagePath = image.url;

    // 4. Delete from DB first (source of truth)
    const { error: dbError } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('[DELETE /api/images/[id]] DB delete error:', dbError.message);
      return NextResponse.json(
        { success: false, message: 'Failed to delete image record from database.' },
        { status: 500 }
      );
    }

    // 5. Delete from Storage (best-effort — don't fail if file is already gone)
    const { error: storageError } = await supabase
      .storage
      .from('gallery_bucket')
      .remove([storagePath]);

    if (storageError) {
      // Log but don't fail — DB record is already gone, storage orphan is not critical
      console.warn(
        `[DELETE /api/images/[id]] Storage delete warning for "${storagePath}":`,
        storageError.message
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[DELETE /api/images/[id]] Unexpected error:', err);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred during deletion.' },
      { status: 500 }
    );
  }
}
