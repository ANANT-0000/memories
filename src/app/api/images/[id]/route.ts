import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminToken = (await cookies()).get('admin_token');
  if (!adminToken) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id } = await params;
    
    // Body should contain the original bucket path/url to delete from storage
    // But since the frontend has a signed URL, we can't extract the path directly from it safely
    // Wait, let's fetch the original path from the DB first before deleting.
    const supabase = getAdminSupabase();
    
    const { data: image, error: fetchError } = await supabase
      .from('gallery_images')
      .select('url')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ success: false, message: 'Image not found in database' }, { status: 404 });
    }

    const originalPath = image.url; // This is 'images/filename.jpg'

    // 1. Delete from Storage
    const { error: storageError } = await supabase
      .storage
      .from('gallery_bucket')
      .remove([originalPath]);

    if (storageError) {
      console.error('Storage Delete Error:', storageError);
      return NextResponse.json({ success: false, message: 'Failed to delete from storage' }, { status: 500 });
    }

    // 2. Delete from Database
    const { error: dbError } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Database Delete Error:', dbError);
      return NextResponse.json({ success: false, message: 'Failed to delete from database' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
