"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import SwipeCarousel from "@/components/SwipeCarousel";

type ImageType = {
  id: string;
  url: string;
  sort_order: number;
};

export default function GalleryView() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const res = await fetch("/api/images");
      const data = await res.json();
      if (data.images) {
        setImages(data.images);
      }
    } catch (error) {
      console.error("Failed to fetch images", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % images.length);
  };

  const handlePrev = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
  };

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
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h1 className="text-white font-semibold text-lg tracking-tight">Gallery</h1>
        <button
          onClick={() => router.push("/admin")}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          title="Admin"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Gallery Grid */}
      <main className="p-2 sm:p-4">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <p className="text-white/30 text-sm">No images yet.</p>
            <button
              onClick={() => router.push("/admin")}
              className="text-white/50 border border-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/5 transition-colors"
            >
              Upload images in Admin →
            </button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-3">
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                className="break-inside-avoid mb-2 sm:mb-3 relative group cursor-pointer overflow-hidden rounded-lg sm:rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                onClick={() => setSelectedIndex(index)}
                whileTap={{ scale: 0.97 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Gallery item ${index + 1}`}
                  className="w-full h-auto object-cover block"
                  loading="lazy"
                />
                {/* Hover overlay — desktop only */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 hidden sm:block" />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Swipe Carousel Lightbox */}
      {selectedIndex !== null && (
        <SwipeCarousel
          images={images}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}
    </div>
  );
}
