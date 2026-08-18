"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import SwipeCarousel from "@/components/SwipeCarousel";

type ImageType = {
  id: string;
  url: string;
  sort_order: number;
};

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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle cached images that might not fire onLoad
  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div
      className="mb-2 sm:mb-3 relative group cursor-pointer overflow-hidden rounded-lg sm:rounded-xl"
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        ref={imgRef}
        src={img.url}
        alt={`Gallery item ${index + 1}`}
        className="w-full h-auto object-cover block"
        loading={isPriority ? "eager" : "lazy"}
        fetchPriority={isPriority ? "high" : "low"}
        decoding={isPriority ? "sync" : "async"}
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

      {/* Hover overlay — desktop only */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 hidden sm:block pointer-events-none" />
    </div>
  );
}

// ── Main gallery view ─────────────────────────────────────────────────────────
export default function GalleryView() {
  const router = useRouter();
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Image loading limit
  const [visibleLimit, setVisibleLimit] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Layout state
  const [columnsCount, setColumnsCount] = useState(2);

  // 1. Session check on mount
  useEffect(() => {
    if (!sessionStorage.getItem("gallery_session")) {
      // Clear cookie and redirect so it asks for PIN again
      fetch("/api/auth", { method: "DELETE" }).catch(() => {});
      window.location.replace("/lock");
      return;
    }
    
    setIsSessionValid(true);
  }, []);

  // 2. Fetch images
  useEffect(() => {
    if (!isSessionValid) return;

    fetch("/api/images")
      .then((r) => {
        if (r.status === 401) {
          window.location.replace("/lock");
          return;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.images) setImages(data.images);
      })
      .catch((e) => console.error("Failed to fetch images", e))
      .finally(() => setLoading(false));
  }, [isSessionValid]);

  // 3. Responsive columns
  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1280) setColumnsCount(5); // xl
      else if (window.innerWidth >= 1024) setColumnsCount(4); // lg
      else if (window.innerWidth >= 640) setColumnsCount(3); // sm
      else setColumnsCount(2);
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // 4. Infinite scroll / lazy loading logic
  useEffect(() => {
    if (loading || !isSessionValid || images.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleLimit((prev) => Math.min(prev + 12, images.length));
        }
      },
      { rootMargin: "400px" } // trigger before user hits the bottom
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loading, isSessionValid, images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((i) =>
      i === null ? null : (i - 1 + images.length) % images.length
    );
  }, [images.length]);

  if (!isSessionValid) {
    // Return nothing while checking session to prevent flash of content
    return null;
  }

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

  // Distribute visible images into columns for JS-based masonry
  const visibleImages = images.slice(0, visibleLimit);
  const columns: { img: ImageType; originalIndex: number }[][] = Array.from(
    { length: columnsCount },
    () => []
  );

  visibleImages.forEach((img, index) => {
    columns[index % columnsCount].push({ img, originalIndex: index });
  });

  return (
    <div className="min-h-dvh bg-black">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-center">
        <h1 className="text-white font-semibold text-lg tracking-tight">Gallery</h1>
      </header>

      {/* Gallery Grid */}
      <main className="p-2 sm:p-4 pb-20">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <p className="text-white/30 text-sm">No images yet.</p>
            <button
              onClick={() => router.push("/admin")}
              className="text-white/50 border border-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/5 transition-colors"
            >
              Upload images via /admin →
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 sm:gap-3 items-start">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col">
                  {col.map((item) => (
                    <GalleryTile
                      key={item.img.id}
                      img={item.img}
                      index={item.originalIndex}
                      isPriority={item.originalIndex < 6}
                      onClick={() => setSelectedIndex(item.originalIndex)}
                    />
                  ))}
                </div>
              ))}
            </div>
            
            {/* Infinite Scroll Sentinel */}
            {visibleLimit < images.length && (
              <div ref={loadMoreRef} className="h-20 w-full mt-4 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}
          </>
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
