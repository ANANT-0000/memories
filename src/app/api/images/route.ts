import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';

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
  const token = (await cookies()).get('auth_token');
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    
    const supabase = getAdminSupabase();

    // 1. Upload to Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('gallery_bucket')
      .upload(`images/${fileName}`, fileBuffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      return NextResponse.json({ success: false, message: 'Storage upload failed' }, { status: 500 });
    }

    // 2. Insert into Database
    const { data: insertData, error: dbError } = await supabase
      .from('gallery_images')
      .insert({
        url: `images/${fileName}`,
        sort_order: Date.now() // Simple way to append to the end
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB Insert Error:', dbError);
      return NextResponse.json({ success: false, message: 'Database insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, image: insertData });

  } catch (error) {
    console.error('Upload POST Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
