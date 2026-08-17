"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SwipeCarousel from "@/components/SwipeCarousel";

type ImageType = {
  id: string;
  url: string;
  sort_order: number;
};

// How many images are above-the-fold and need priority loading
// (2 columns × ~3 visible rows = 6 images)
const PRIORITY_COUNT = 6;

// ── Single image tile ─────────────────────────────────────────────────────────
function GalleryTile({
  img,
  index,
  isPriority,
  onClick,
}: {
  img: ImageType;
  index: number;
  isPriority: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(isPriority);
  const [loaded, setLoaded] = useState(false);

  // Non-priority tiles: start rendering once 200px from viewport
  useEffect(() => {
    if (isPriority) return; // already rendering
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPriority]);

  return (
    <div
      ref={ref}
      className="break-inside-avoid mb-2 sm:mb-3 relative group cursor-pointer overflow-hidden rounded-lg sm:rounded-xl"
      onClick={onClick}
    >
      {/* Skeleton: fixed min-height so layout doesn't shift before image loads */}
      <div
        className={`w-full bg-white/[0.06] rounded-lg sm:rounded-xl transition-opacity duration-500 ${
          loaded ? "opacity-0 absolute inset-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ minHeight: isPriority ? 200 : 120 }}
        aria-hidden
      />

      {shouldRender && (
        <motion.img
          // eslint-disable-next-line @next/next/no-img-element
          src={img.url}
          alt={`Gallery item ${index + 1}`}
          className="w-full h-auto object-cover block"
          // Priority images: eager + high fetchPriority — browser loads them immediately
          // Off-screen images: lazy + low fetchPriority — loaded only when near viewport
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : "low"}
          decoding={isPriority ? "sync" : "async"}
          // Hint browser to right size: ~50vw on mobile, ~33vw on tablet, ~25vw on desktop
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setLoaded(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{
            opacity: {
              duration: isPriority ? 0.25 : 0.4,
              delay: isPriority ? index * 0.03 : 0,
              ease: "easeOut",
            },
          }}
        />
      )}

      {/* Hover overlay — desktop only */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 hidden sm:block pointer-events-none" />
    </div>
  );
}

// ── Main gallery view ─────────────────────────────────────────────────────────
export default function GalleryView() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    // ── Session guard ──────────────────────────────────────────────────────
    // sessionStorage is wiped by the browser on tab/window close.
    // If the flag is missing this is a new session — go straight to /lock.
    // PinScreen will clear the old cookie on mount before asking for the PIN.
    if (!sessionStorage.getItem('gallery_session')) {
      window.location.replace('/lock');
      return;
    }

    fetch("/api/images")
      .then((r) => r.json())
      .then((data) => {
        if (data.images) setImages(data.images);
      })
      .catch((e) => console.error("Failed to fetch images", e))
      .finally(() => setLoading(false));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedIndex((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((i) =>
      i === null ? null : (i - 1 + images.length) % images.length
    );
  }, [images.length]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading gallery…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-center">
        <h1 className="text-white font-semibold text-lg tracking-tight">Gallery</h1>
      </header>

      {/* Gallery Grid */}
      <main className="p-2 sm:p-4">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <p className="text-white/30 text-sm">No images yet.</p>
            <button
              onClick={() => (window.location.href = "/admin")}
              className="text-white/50 border border-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/5 transition-colors"
            >
              Upload images via /admin →
            </button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-3">
            {images.map((img, index) => (
              <GalleryTile
                key={img.id}
                img={img}
                index={index}
                isPriority={index < PRIORITY_COUNT}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Swipe Carousel Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <SwipeCarousel
            images={images}
            currentIndex={selectedIndex}
            onClose={() => setSelectedIndex(null)}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
