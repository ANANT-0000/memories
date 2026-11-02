import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Admin auth check
  const adminToken = (await cookies()).get('admin_token');
  if (!adminToken) {
    logger.warn('Forbidden delete attempt without admin token');
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
      logger.error('Failed to locate image for deletion', fetchError, { id });
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
      logger.error('Failed to delete image record from DB', dbError, { id });
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
      logger.warn('Storage file cleanup warning after DB delete', {
        id,
        storagePath,
        error: storageError.message,
      });
    } else {
      logger.info('Image deleted successfully from DB and Storage', { id, storagePath });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Unexpected error in DELETE /api/images/[id]', err, { id });
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred during deletion.' },
      { status: 500 }
    );
  }
}
