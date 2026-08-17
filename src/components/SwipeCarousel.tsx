"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
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

// Spring transition shared for sliding
const SLIDE_TRANSITION = {
  type: "spring" as const,
  stiffness: 280,
  damping: 32,
  mass: 0.8,
};

// Sliding variants — direction: +1 forward (right-to-left), -1 back (left-to-right)
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 1,
  }),
  center: {
    x: "0%",
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 1,
  }),
};

export default function SwipeCarousel({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: SwipeCarouselProps) {
  const [direction, setDirection] = useState(0);
  const dragX = useMotionValue(0);
  const bgOpacity = useTransform(dragX, [-200, 0, 200], [0.6, 1, 0.6]);
  const isDragging = useRef(false);

  const total = images.length;
  const current = images[currentIndex];
  const nextImg = images[(currentIndex + 1) % total];
  const prevImg = images[(currentIndex - 1 + total) % total];

  const goNext = useCallback(() => {
    setDirection(1);
    onNext();
  }, [onNext]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    onPrev();
  }, [onPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      isDragging.current = false;
      const { offset, velocity } = info;

      // Swipe down → close
      if (offset.y > 120 || velocity.y > 600) {
        animate(dragX, 0, { duration: 0.1 });
        onClose();
        return;
      }

      // Swipe left → next
      if (offset.x < -60 || velocity.x < -400) {
        animate(dragX, 0, { duration: 0.1 });
        goNext();
        return;
      }

      // Swipe right → prev
      if (offset.x > 60 || velocity.x > 400) {
        animate(dragX, 0, { duration: 0.1 });
        goPrev();
        return;
      }

      // Snap back
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 40 });
    },
    [goNext, goPrev, onClose, dragX]
  );

  if (!current) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ touchAction: "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Background */}
      <motion.div
        className="absolute inset-0 bg-black"
        style={{ opacity: bgOpacity }}
        onClick={onClose}
      />

      {/* — Preload adjacent images (caching) — */}
      {/* Rendered off-screen so browser fetches and caches them */}
      {total > 1 && (
        <>
          <img src={nextImg.url} alt="" aria-hidden className="sr-only absolute opacity-0 pointer-events-none w-px h-px" fetchPriority="low" />
          <img src={prevImg.url} alt="" aria-hidden className="sr-only absolute opacity-0 pointer-events-none w-px h-px" fetchPriority="low" />
        </>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white/50 text-sm tabular-nums select-none">
        {currentIndex + 1} / {total}
      </div>

      {/* Swipe hint (mobile, fades after 2s) */}
      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 text-white/25 text-xs md:hidden select-none pointer-events-none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2.5, duration: 1 }}
      >
        Swipe left/right · down to close
      </motion.p>

      {/* Desktop nav arrows */}
      {total > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white backdrop-blur-sm transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white backdrop-blur-sm transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Sliding image track */}
      <div className="relative z-40 w-full h-full flex items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={current.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
            className="absolute inset-0 flex items-center justify-center px-2 sm:px-16"
            style={{ x: dragX }}
            drag
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={{ top: 0.15, bottom: 0.4, left: 0.15, right: 0.15 }}
            onDragStart={() => { isDragging.current = true; }}
            onDragEnd={handleDragEnd}
            whileDrag={{ cursor: "grabbing" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={`Image ${currentIndex + 1} of ${total}`}
              className="max-w-full max-h-[90dvh] object-contain rounded-xl shadow-2xl select-none pointer-events-none"
              draggable={false}
              fetchPriority="high"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      {total > 1 && total <= 20 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 pointer-events-none">
          {images.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === currentIndex ? 16 : 6,
                backgroundColor: i === currentIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="h-1.5 rounded-full"
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
