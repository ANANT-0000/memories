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

// Slide variants — entry/exit only, completely independent of drag state
const slideVariants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? "100%" : "-100%",
    opacity: 1,
  }),
  center: {
    x: "0%",
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? "-100%" : "100%",
    opacity: 1,
  }),
};

const SLIDE_TRANSITION = {
  type: "tween" as const,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
  duration: 0.32,
};

export default function SwipeCarousel({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: SwipeCarouselProps) {
  const [direction, setDirection] = useState(0);

  // dragX/dragY: ONLY used for live visual feedback during the drag gesture.
  // They are INSTANTLY zeroed (via .set()) before any navigation call, so the
  // slide animation always starts from a clean x=0 container — this is the fix
  // for the "left swipe shows invisible image" bug.
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  // Background dims as user drags away from center
  const bgOpacity = useTransform(dragY, [0, 250], [1, 0.3]);

  const isDragging = useRef(false);
  const isAnimating = useRef(false);

  const total = images.length;
  const current = images[currentIndex];
  const nextImg = images[(currentIndex + 1) % total];
  const prevImg = images[(currentIndex - 1 + total) % total];

  // ── Navigation — always reset drag FIRST before updating direction/index ──
  const goNext = useCallback(() => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    // Instant reset — no spring — so container is at x=0 when slide enters
    dragX.set(0);
    dragY.set(0);
    setDirection(1);
    onNext();
    setTimeout(() => { isAnimating.current = false; }, 350);
  }, [onNext, dragX, dragY]);

  const goPrev = useCallback(() => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    dragX.set(0);
    dragY.set(0);
    setDirection(-1);
    onPrev();
    setTimeout(() => { isAnimating.current = false; }, 350);
  }, [onPrev, dragX, dragY]);

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

      // Swipe down to close
      if (offset.y > 90 || velocity.y > 450) {
        animate(dragX, 0, { duration: 0.1 });
        animate(dragY, 0, { duration: 0.1 });
        onClose();
        return;
      }

      // Swipe left → next (dragX goes negative when swiping left)
      if (offset.x < -50 || velocity.x < -300) {
        // goNext() calls dragX.set(0) instantly — no conflict with animation
        goNext();
        return;
      }

      // Swipe right → prev (dragX goes positive when swiping right)
      if (offset.x > 50 || velocity.x > 300) {
        goPrev();
        return;
      }

      // Snap back to center
      animate(dragX, 0, { type: "spring", stiffness: 500, damping: 40 });
      animate(dragY, 0, { type: "spring", stiffness: 500, damping: 40 });
    },
    [goNext, goPrev, onClose, dragX, dragY]
  );

  if (!current) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ touchAction: "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Background — dims on vertical drag (close gesture) */}
      <motion.div
        className="absolute inset-0 bg-black"
        style={{ opacity: bgOpacity }}
        onClick={onClose}
      />

      {/* Preload adjacent images silently */}
      {total > 1 && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={nextImg.url} alt="" aria-hidden className="absolute opacity-0 pointer-events-none w-0 h-0" fetchPriority="low" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={prevImg.url} alt="" aria-hidden className="absolute opacity-0 pointer-events-none w-0 h-0" fetchPriority="low" />
        </>
      )}

      {/* Close button — outside drag container so it's never displaced */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white/50 text-sm tabular-nums select-none pointer-events-none">
        {currentIndex + 1} / {total}
      </div>

      {/* Swipe hint — fades after 2.5s */}
      <motion.p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 text-white/30 text-xs md:hidden select-none pointer-events-none"
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

      {/* ── Drag layer — wraps ONLY the sliding content, not UI chrome ──────── */}
      {/* dragX/dragY give live drag feedback. They are always .set(0) before   */}
      {/* navigation fires, so AnimatePresence slides from a clean x=0 origin.  */}
      <motion.div
        className="absolute inset-0 z-40 overflow-hidden"
        style={{ x: dragX, y: dragY }}
        drag
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={{ top: 0.08, bottom: 0.4, left: 0.15, right: 0.15 }}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={handleDragEnd}
        whileDrag={{ cursor: "grabbing" }}
      >
        {/* Slide track — AnimatePresence handles enter/exit purely via CSS transforms */}
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={current.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
            className="absolute inset-0 flex items-center justify-center px-3 sm:px-16"
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
      </motion.div>

      {/* Dot indicators — outside drag layer */}
      {total > 1 && total <= 20 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 pointer-events-none">
          {images.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === currentIndex ? 16 : 6,
                backgroundColor:
                  i === currentIndex
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.25)",
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
