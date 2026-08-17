"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type ImageType = {
  id: string;
  url: string;
  sort_order: number;
};

interface SwipeCarouselProps {
  images: ImageType[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function SwipeCarousel({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: SwipeCarouselProps) {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-200, 0, 200], [0, 1, 0]);
  const scale = useTransform(y, [-200, 0, 200], [0.85, 1, 0.85]);
  const bgOpacity = useTransform(y, [-150, 0, 150], [0, 1, 0]);

  const currentImage = images[currentIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNext, onPrev, onClose]);

  // Prevent body scroll when carousel is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;

      // Swipe Down to close
      if (offset.y > 100 || velocity.y > 500) {
        onClose();
        return;
      }

      // Swipe Left → next
      if (offset.x < -80 || velocity.x < -500) {
        onNext();
        return;
      }

      // Swipe Right → prev
      if (offset.x > 80 || velocity.x > 500) {
        onPrev();
        return;
      }
    },
    [onClose, onNext, onPrev]
  );

  if (!currentImage) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ touchAction: "none" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Blurred dark background */}
        <motion.div
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
          style={{ opacity: bgOpacity }}
          onClick={onClose}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white/60 text-sm font-medium tabular-nums">
          {currentIndex + 1} / {images.length}
        </div>

        {/* Swipe hint — only on mobile, fades out */}
        <motion.p
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 text-white/30 text-xs md:hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 2, duration: 1 }}
        >
          Swipe ↕ to close · ← → to navigate
        </motion.p>

        {/* Prev / Next buttons (desktop) */}
        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white backdrop-blur-sm transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white backdrop-blur-sm transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Image — draggable */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage.id}
            className="relative z-40 max-w-[95vw] max-h-[90dvh] flex items-center justify-center"
            style={{ y, opacity, scale }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={{ top: 0.3, bottom: 0.3, left: 0.2, right: 0.2 }}
            onDragEnd={handleDragEnd}
            whileDrag={{ cursor: "grabbing" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.url}
              alt={`Image ${currentIndex + 1}`}
              className="max-w-full max-h-[90dvh] object-contain rounded-xl shadow-2xl select-none pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (i > currentIndex) onNext();
                  else if (i < currentIndex) onPrev();
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === currentIndex ? "bg-white w-4" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
