"use client";

import { useState, useRef, useCallback } from "react";
import {
  UploadCloud, Loader2, Trash2, ArrowLeft,
  Image as ImageIcon, LogOut, CheckCircle,
  XCircle, Check, X
} from "lucide-react";
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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // ─── Upload logic ────────────────────────────────────────────────────────────
  const uploadFile = async (file: File, queueId: string) => {
    setUploadQueue((q) => q.map((u) => u.id === queueId ? { ...u, status: "uploading" } : u));

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/images", { method: "POST", body: fd });
      const data = await res.json();

      if (data.success) {
        setUploadQueue((q) =>
          q.map((u) => u.id === queueId ? { ...u, status: "done", savedPercent: data.compression?.savedPercent } : u)
        );
        // Image list refresh is handled in processFiles after all uploads complete
      } else {
        setUploadQueue((q) =>
          q.map((u) => u.id === queueId ? { ...u, status: "error", error: data.message } : u)
        );
      }
    } catch {
      setUploadQueue((q) =>
        q.map((u) => u.id === queueId ? { ...u, status: "error", error: "Network error" } : u)
      );
    }
  };

  // ─── Controlled upload queue (max CONCURRENCY uploads at once) ───────────────
  const CONCURRENCY = 2;

  const processFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => {
      const type = f.type.toLowerCase();
      const name = f.name.toLowerCase();
      const ext = name.match(/\.[0-9a-z]+$/)?.[0] || "";
      const validExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic", ".heif", ".tiff", ".tif", ".bmp"];
      return type.startsWith("image/") || validExts.includes(ext);
    });
    if (!imageFiles.length) return;

    const items: UploadItem[] = imageFiles.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      status: "pending",
    }));
    setUploadQueue((q) => [...q, ...items]);

    // Run uploads with at most CONCURRENCY in-flight at once
    const pairs = imageFiles.map((f, i) => ({ file: f, queueId: items[i].id }));
    let cursor = 0;

    const runNext = async (): Promise<void> => {
      if (cursor >= pairs.length) return;
      const { file, queueId } = pairs[cursor++];
      await uploadFile(file, queueId);
      await runNext(); // pick up the next job in this "slot"
    };

    // Start CONCURRENCY slots concurrently
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, runNext)
    );

    // After all uploads finish, do a single refresh of the image list
    try {
      const listRes = await fetch("/api/images");
      const listData = await listRes.json();
      if (listData.success && listData.images) {
        setImages(listData.images);
      }
    } catch { /* non-critical */ }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  // ─── Selection mode ──────────────────────────────────────────────────────────
  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelected(new Set());
  }, []);

  const toggleSelectMode = () => {
    setSelectMode((s) => !s);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(images.map((img) => img.id)));
  };

  // ─── Long-press to enter select mode (mobile) ────────────────────────────────
  const handleLongPressStart = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      if (!selectMode) {
        enterSelectMode();
        setSelected(new Set([id]));
      }
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const confirmed = confirm(
      selected.size === 1
        ? "Delete this image?"
        : `Delete ${selected.size} images?`
    );
    if (!confirmed) return;

    setDeleting(true);

    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/images/${id}`, { method: "DELETE" }))
    );

    const deleted = ids.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value.ok;
    });

    setImages((prev) => prev.filter((img) => !deleted.includes(img.id)));
    setSelected(new Set());
    setSelectMode(false);
    setDeleting(false);

    if (deleted.length < ids.length) {
      alert(`${ids.length - deleted.length} image(s) failed to delete.`);
    }
  };

  // ─── Admin logout ────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await fetch("/api/admin-auth", { method: "DELETE" });
    router.push("/admin/lock");
  };

  const activeUploads = uploadQueue.filter((u) => u.status === "uploading" || u.status === "pending");

  return (
    <div className="min-h-dvh bg-zinc-950 pb-32">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2 px-4 py-3">
          {selectMode ? (
            <>
              {/* Cancel selection */}
              <button
                onClick={toggleSelectMode}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-white font-medium text-base flex-1">
                {selected.size === 0 ? "Tap images to select" : `${selected.size} selected`}
              </span>
              {/* Select all */}
              <button
                onClick={selectAll}
                className="text-amber-400/80 hover:text-amber-400 text-sm px-3 py-1.5 rounded-lg hover:bg-amber-400/10 transition-colors"
              >
                All
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => router.push("/")}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-white font-semibold text-lg flex-1 flex items-center gap-2">
                Admin
                <span className="text-xs text-amber-400/60 font-normal border border-amber-400/20 px-2 py-0.5 rounded-full">
                  Protected
                </span>
              </h1>
              {images.length > 0 && (
                <button
                  onClick={enterSelectMode}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm px-3 py-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 transition-colors font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Select
                </button>
              )}
              <button
                onClick={handleLogout}
                title="Lock admin"
                className="w-9 h-9 rounded-full bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">

        {/* ── Upload zone (hidden in select mode) ───────────────────────── */}
        <AnimatePresence>
          {!selectMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-amber-400/40 bg-amber-400/5"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.02] active:bg-white/5"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,.heic,.heif,.HEIC,.HEIF,.tiff,.tif,.bmp,.webp,.avif"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <UploadCloud className={`w-9 h-9 mb-2 transition-colors ${dragOver ? "text-amber-400/60" : "text-white/20"}`} />
                <p className="text-white/50 text-sm font-medium text-center">
                  {dragOver ? "Drop to upload" : "Tap to select images"}
                </p>
                <p className="text-white/20 text-xs mt-1">Multiple files supported · Auto WebP compression</p>
              </div>

              {/* Upload queue */}
              <AnimatePresence>
                {uploadQueue.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 space-y-2"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Uploads</p>
                      {activeUploads.length === 0 && (
                        <button onClick={() => setUploadQueue([])} className="text-white/20 text-xs hover:text-white/40 transition-colors">
                          Clear
                        </button>
                      )}
                    </div>
                    {uploadQueue.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
                      >
                        {item.status === "done" && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                        {item.status === "error" && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                        {(item.status === "uploading" || item.status === "pending") && (
                          <Loader2 className={`w-4 h-4 shrink-0 ${item.status === "uploading" ? "text-amber-400 animate-spin" : "text-white/20"}`} />
                        )}
                        <span className="text-white/60 text-sm truncate flex-1 min-w-0">{item.name}</span>
                        {item.status === "done" && item.savedPercent !== undefined && (
                          <span className="text-green-400/60 text-xs shrink-0">-{item.savedPercent}%</span>
                        )}
                        {item.status === "error" && (
                          <span className="text-red-400/60 text-xs shrink-0 max-w-[100px] text-right">{item.error}</span>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Image count label ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-widest">
            {images.length === 0 ? "No images" : `${images.length} image${images.length === 1 ? "" : "s"}`}
          </p>
          {selectMode && (
            <p className="text-white/30 text-xs">
              {selected.size === 0 ? "Tap to select · Hold to start" : `${selected.size} selected`}
            </p>
          )}
        </div>

        {/* ── Image grid ────────────────────────────────────────────────── */}
        {images.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <ImageIcon className="w-12 h-12 text-white/10" />
            <p className="text-white/20 text-sm">Upload your first image above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <AnimatePresence>
              {images.map((img) => {
                const isSelected = selected.has(img.id);
                return (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    onClick={() => selectMode && toggleSelect(img.id)}
                    onTouchStart={() => handleLongPressStart(img.id)}
                    onTouchEnd={handleLongPressEnd}
                    onMouseDown={() => handleLongPressStart(img.id)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    className={`relative aspect-square bg-white/5 rounded-xl overflow-hidden select-none ${
                      selectMode ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt="Gallery item"
                      draggable={false}
                      className={`w-full h-full object-cover transition-all duration-200 ${
                        isSelected ? "scale-95 brightness-50" : selectMode ? "brightness-75" : ""
                      }`}
                    />

                    {/* Selection overlay */}
                    <AnimatePresence>
                      {selectMode && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <motion.div
                            animate={{
                              scale: isSelected ? 1 : 0.8,
                              opacity: isSelected ? 1 : 0.7,
                            }}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors shadow-lg ${
                              isSelected
                                ? "bg-amber-400 border-amber-400"
                                : "bg-black/50 border-white/70 backdrop-blur-sm"
                            }`}
                          >
                            {isSelected && <Check className="w-4 h-4 text-black" strokeWidth={3} />}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ── Long press hint (non-select mode, has images) ─────────────── */}
        {!selectMode && images.length > 0 && (
          <p className="text-center text-white/15 text-xs mt-6">
            Hold an image or tap <span className="text-amber-400/40">Select</span> to delete
          </p>
        )}
      </main>

      {/* ── Bottom action bar (select mode only) ──────────────────────────── */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 inset-x-0 z-40 bg-zinc-900/95 backdrop-blur-xl border-t border-white/5 p-4 pb-safe"
          >
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <button
                onClick={toggleSelectMode}
                className="flex-1 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 font-medium transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={deleteSelected}
                disabled={selected.size === 0 || deleting}
                className="flex-1 h-12 rounded-2xl bg-red-500/80 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting
                  ? "Deleting…"
                  : selected.size === 0
                  ? "Select images"
                  : `Delete ${selected.size}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
