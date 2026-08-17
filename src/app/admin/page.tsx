import AdminDashboard from "@/components/AdminDashboard";
import { getAdminSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic"; // Ensure fresh data on admin load

export default async function AdminPage() {
  const supabase = getAdminSupabase();

  // Fetch all images for the admin
  const { data: images } = await supabase
    .from("gallery_images")
    .select("*")
    .order("sort_order", { ascending: true });

  let initialImages = images || [];

  if (initialImages.length > 0) {
    // Generate signed URLs so admin can see thumbnails
    const filePaths = initialImages.map((img) => img.url);
    const { data: signedUrls } = await supabase.storage
      .from("gallery_bucket")
      .createSignedUrls(filePaths, 60 * 5);

    if (signedUrls) {
      initialImages = initialImages.map((img, index) => ({
        ...img,
        url: signedUrls[index]?.signedUrl || img.url,
      }));
    }
  }

  return (
    <main className="min-h-screen bg-black">
      <AdminDashboard initialImages={initialImages} />
    </main>
  );
}
