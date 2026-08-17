"use client";

import { useState } from "react";
import { UploadCloud, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ImageType = {
  id: string;
  url: string;
  sort_order: number;
};

export default function AdminDashboard({ initialImages }: { initialImages: ImageType[] }) {
  const [images, setImages] = useState<ImageType[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.image) {
        // We might want to refresh to get the signed URL if needed,
        // or just rely on a page refresh. For now, trigger a router refresh.
        router.refresh();
      } else {
        alert(data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, url: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const res = await fetch(`/api/images/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        setImages(images.filter((img) => img.id !== id));
        router.refresh();
      } else {
        alert(data.message || "Delete failed");
      }
    } catch (error) {
      console.error("Delete error", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

      {/* Upload Zone */}
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-12 flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors bg-zinc-900/50 mb-12 relative">
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? (
          <Loader2 className="w-10 h-10 mb-4 animate-spin" />
        ) : (
          <UploadCloud className="w-10 h-10 mb-4" />
        )}
        <p className="text-lg font-medium">{uploading ? "Uploading..." : "Click or drag to upload an image"}</p>
      </div>

      {/* Manage Images */}
      <h2 className="text-xl font-semibold text-white mb-6">Manage Images</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="relative group bg-zinc-900 rounded-lg overflow-hidden aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="Gallery item" className="w-full h-full object-cover" />
            
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => handleDelete(img.id, img.url)}
                className="bg-red-500/80 hover:bg-red-600 text-white p-3 rounded-full transition-colors"
                title="Delete Image"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {images.length === 0 && (
        <p className="text-zinc-500 text-center py-8">No images in the gallery yet.</p>
      )}
    </div>
  );
}
