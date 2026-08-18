"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
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

  return (
    <div
      className="mb-2 sm:mb-3 relative group cursor-pointer overflow-hidden rounded-lg sm:rounded-xl active:scale-[0.97] transition-transform duration-150"
      onClick={onClick}
    >
      {/* Skeleton — visible until image finishes loading */}
      <div
        className={`w-full bg-white/[0.06] rounded-lg sm:rounded-xl transition-opacity duration-500 ${
          loaded ? "opacity-0 absolute inset-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ minHeight: isPriority ? 200 : 120 }}
        aria-hidden
      />

      {/*
        Next.js <Image> proxies the Supabase signed URL through Vercel's image
        pipeline: resizes to the requested width, converts to AVIF/WebP, and
        caches at the edge CDN — dramatically faster repeat loads.
        width/height are optimiser hints (not rendered size); style keeps the
        natural aspect ratio in the masonry column.
      */}
      <Image
        src={img.url}
        alt={`Gallery item ${index + 1}`}
        width={800}
        height={600}
        className={`w-full h-auto object-cover block transition-opacity duration-300 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        priority={isPriority}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        onLoad={() => setLoaded(true)}
        style={{ width: "100%", height: "auto" }}
        unoptimized={false}
      />

      {/* Hover overlay — desktop only */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 hidden sm:block pointer-events-none" />
    </div>
  );
}

// ── Main gallery view ─────────────────────────────────────────────────────────
export default function GalleryView({ pin }: { pin: string }) {
  const router = useRouter();
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Image loading limit — start with 20 to ensure full screen coverage on first load
  const [visibleLimit, setVisibleLimit] = useState(20);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Layout state
  const [columnsCount, setColumnsCount] = useState(2);

  // Fetch images on mount
  useEffect(() => {
    fetch("/api/images", {
      headers: { Authorization: `Bearer ${pin}` },
    })
      .then((r) => {
        if (r.status === 401) {
          // If the PIN is invalid on the server, we just force a reload
          // which will clear React state and show the PinScreen again.
          window.location.reload();
          return;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.images) setImages(data.images);
      })
      .catch((e) => console.error("Failed to fetch images", e))
      .finally(() => setLoading(false));
  }, [pin]);

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
    if (loading || images.length === 0) return;

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
  }, [loading, images.length]);

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
