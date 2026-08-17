"use client";

import { useState, useRef } from "react";
import { UploadCloud, Loader2, Trash2, ArrowLeft, Image as ImageIcon, LogOut, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type ImageType = {
  id: string;
  url: string;
  sort_order: number;
};

type UploadItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  savedPercent?: number;
  error?: string;
};

export default function AdminDashboard({ initialImages }: { initialImages: ImageType[] }) {
  const [images, setImages] = useState<ImageType[]>(initialImages);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const uploadFile = async (file: File, queueId: string) => {
    setUploadQueue((prev) =>
      prev.map((u) => (u.id === queueId ? { ...u, status: "uploading" } : u))
    );

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/images", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success) {
        setUploadQueue((prev) =>
          prev.map((u) =>
            u.id === queueId
              ? { ...u, status: "done", savedPercent: data.compression?.savedPercent }
              : u
          )
        );
        router.refresh();
      } else {
        setUploadQueue((prev) =>
          prev.map((u) =>
            u.id === queueId ? { ...u, status: "error", error: data.message } : u
          )
        );
      }
    } catch {
      setUploadQueue((prev) =>
        prev.map((u) => (u.id === queueId ? { ...u, status: "error", error: "Network error" } : u))
      );
    }
  };

  const processFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const newItems: UploadItem[] = imageFiles.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      status: "pending",
    }));

    setUploadQueue((prev) => [...prev, ...newItems]);

    // Upload all files in parallel
    await Promise.all(imageFiles.map((f, i) => uploadFile(f, newItems[i].id)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = ""; // reset so same file can be re-selected
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this image?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setImages((prev) => prev.filter((img) => img.id !== id));
      } else {
        alert(data.message || "Delete failed");
      }
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdminLogout = async () => {
    await fetch("/api/admin-auth", { method: "DELETE" });
    router.push("/admin/lock");
  };

  const activeUploads = uploadQueue.filter((u) => u.status === "uploading" || u.status === "pending");
  const isUploading = activeUploads.length > 0;

  return (
    <div className="min-h-dvh bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/gallery")}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-white font-semibold text-lg flex items-center gap-2">
          Admin
          <span className="text-xs text-amber-400/60 font-normal border border-amber-400/20 px-2 py-0.5 rounded-full">
            Protected
          </span>
        </h1>
        <span className="ml-auto text-white/30 text-sm">{images.length} images</span>
        {/* Admin logout */}
        <button
          onClick={handleAdminLogout}
          title="Lock Admin"
          className="w-9 h-9 rounded-full bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {/* Upload Zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all mb-4 ${
            dragOver
              ? "border-amber-400/40 bg-amber-400/5"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple           // ← multi-select enabled
            className="hidden"
            onChange={handleFileChange}
          />
          <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${dragOver ? "text-amber-400/60" : "text-white/20"}`} />
          <p className="text-white/50 text-sm font-medium">
            {dragOver ? "Drop images to upload" : "Tap to select · or drag & drop"}
          </p>
          <p className="text-white/20 text-xs mt-1">Select multiple images at once</p>
        </div>

        {/* Upload Queue */}
        <AnimatePresence>
          {uploadQueue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6 space-y-2"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Upload Queue</p>
                {!isUploading && (
                  <button
                    onClick={() => setUploadQueue([])}
                    className="text-white/20 hover:text-white/40 text-xs transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {uploadQueue.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
                >
                  {/* Status icon */}
                  {item.status === "done" && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                  {item.status === "error" && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  {(item.status === "uploading" || item.status === "pending") && (
                    <Loader2 className={`w-4 h-4 shrink-0 ${item.status === "uploading" ? "text-amber-400 animate-spin" : "text-white/20"}`} />
                  )}

                  {/* Filename */}
                  <span className="text-white/60 text-sm truncate flex-1">{item.name}</span>

                  {/* Savings badge */}
                  {item.status === "done" && item.savedPercent !== undefined && (
                    <span className="text-green-400/70 text-xs shrink-0">
                      -{item.savedPercent}% WebP
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="text-red-400/70 text-xs shrink-0">{item.error}</span>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Images grid */}
        <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
          {images.length === 0 ? "No images yet" : "Manage Images"}
        </h2>

        {images.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <ImageIcon className="w-12 h-12 text-white/10" />
            <p className="text-white/20 text-sm">Upload your first image above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <AnimatePresence>
              {images.map((img) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group aspect-square bg-white/5 rounded-xl overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="Gallery item" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-200 flex items-center justify-center">
                    <button
                      onClick={() => handleDelete(img.id)}
                      disabled={deletingId === img.id}
                      className="opacity-0 group-hover:opacity-100 bg-red-500/80 hover:bg-red-500 text-white p-3 rounded-full transition-all disabled:opacity-50"
                    >
                      {deletingId === img.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
