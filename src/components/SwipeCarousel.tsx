"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import NextImage from "next/image";
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

const VELOCITY_THRESHOLD = 0.3; // px/ms
const DISTANCE_THRESHOLD = 0.3; // fraction of screen width

export default function SwipeCarousel({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: SwipeCarouselProps) {
  const total = images.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Overlay fade-in on mount ──────────────────────────────────────────────
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // tiny rAF delay to let the DOM paint before fading in
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Position the track without any transition when index changes externally ─
  const setTrackX = useCallback(
    (x: number, animated: boolean) => {
      const el = trackRef.current;
      if (!el) return;
      el.style.transition = animated
        // ease-out-expo: starts quick (follows finger velocity) then
        // floats to a stop — same curve Apple uses for scroll momentum.
        ? "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)"
        : "none";
      el.style.transform = `translateX(${x}px)`;
    },
    []
  );

  // Compute the resting translateX for a given index
  const restingX = useCallback(
    (idx: number) => {
      const w = containerRef.current?.offsetWidth ?? window.innerWidth;
      return -idx * w;
    },
    []
  );

  // Snap track to currentIndex with no animation on mount / external change
  useLayoutEffect(() => {
    setTrackX(restingX(currentIndex), false);
  }, [currentIndex, restingX, setTrackX]);

  // ── Preload prev / next ───────────────────────────────────────────────────
  useEffect(() => {
    const preload = (url: string) => {
      const img = new Image();
      img.src = url;
    };
    if (total > 1) {
      preload(images[(currentIndex + 1) % total].url);
      preload(images[(currentIndex - 1 + total) % total].url);
    }
  }, [currentIndex, images, total]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onClose]);

  // ── Touch / pointer drag ──────────────────────────────────────────────────
  const dragState = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    startTrackX: 0,
    active: false,
    axis: null as "x" | "y" | null,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    // Read current translate from inline style (already set)
    const currentX = restingX(currentIndex);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: e.timeStamp,
      startTrackX: currentX,
      active: true,
      axis: null,
    };
    el.style.transition = "none";
    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.active) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;

    // Determine scroll axis on first significant move
    if (!ds.axis) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        ds.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      return;
    }

    if (ds.axis === "y") {
      // Swipe down to close: fade background
      const progress = Math.min(Math.max(dy / 300, 0), 1);
      if (containerRef.current) {
        containerRef.current.style.opacity = `${1 - progress * 0.6}`;
      }
      return;
    }

    // Horizontal drag — move the track
    const el = trackRef.current;
    if (!el) return;

    // Rubber-band at edges
    let newX = ds.startTrackX + dx;
    const minX = -(total - 1) * (containerRef.current?.offsetWidth ?? window.innerWidth);
    const maxX = 0;
    if (newX > maxX) newX = maxX + dx * 0.15;
    if (newX < minX) newX = minX + (dx - (minX - ds.startTrackX)) * 0.15;

    el.style.transform = `translateX(${newX}px)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.active) return;
    ds.active = false;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    const dt = e.timeStamp - ds.startTime;

    // Swipe down to close
    if (ds.axis === "y" && (dy > 90 || dy / dt > VELOCITY_THRESHOLD)) {
      onClose();
      return;
    }

    if (containerRef.current) containerRef.current.style.opacity = "1";

    if (ds.axis !== "x") {
      // No drag — snap back
      setTrackX(restingX(currentIndex), true);
      return;
    }

    const w = containerRef.current?.offsetWidth ?? window.innerWidth;
    const velocity = Math.abs(dx) / dt;
    const fraction = Math.abs(dx) / w;
    const shouldAdvance = velocity > VELOCITY_THRESHOLD || fraction > DISTANCE_THRESHOLD;

    if (shouldAdvance && dx < 0 && currentIndex < total - 1) {
      setTrackX(restingX(currentIndex + 1), true);
      // tiny delay so the smooth animation has already started before
      // React re-renders and re-positions the track at the new index
      setTimeout(() => onNext(), 16);
    } else if (shouldAdvance && dx > 0 && currentIndex > 0) {
      setTrackX(restingX(currentIndex - 1), true);
      setTimeout(() => onPrev(), 16);
    } else {
      // Snap back
      setTrackX(restingX(currentIndex), true);
    }
  };

  // ── Fade-close helper ─────────────────────────────────────────────────────
  const [closing, setClosing] = useState(false);
  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
        background: "black",
        touchAction: "none",
      }}
    >
      {/* ── UI Chrome (above the strip) ─────────────────────────────────── */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white/50 text-sm tabular-nums select-none pointer-events-none">
        {currentIndex + 1} / {total}
      </div>

      {/* Swipe hint — fades after 2.5s */}
      <p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 text-white/30 text-xs md:hidden select-none pointer-events-none"
        style={{
          animation: "fadeOutHint 1s ease 2.5s forwards",
        }}
      >
        Swipe left/right · down to close
      </p>

      {/* Desktop nav arrows */}
      {total > 1 && (
        <>
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white backdrop-blur-sm transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white backdrop-blur-sm transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && total <= 20 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 pointer-events-none">
          {images.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === currentIndex ? 16 : 6,
                backgroundColor:
                  i === currentIndex
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      )}

      {/* ── Sliding strip — all images laid out side by side ─────────────── */}
      <div
        className="absolute inset-0 overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: "grab" }}
      >
        <div
          ref={trackRef}
          className="absolute inset-y-0 left-0 flex"
          style={{
            width: `${total * 100}%`,
            willChange: "transform",
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.id}
              className="flex items-center justify-center px-3 sm:px-16"
              style={{ width: `${100 / total}%` }}
            >
              <NextImage
                src={img.url}
                alt={`Image ${i + 1} of ${total}`}
                width={1600}
                height={1200}
                className="max-w-full max-h-[90dvh] object-contain rounded-xl shadow-2xl select-none pointer-events-none"
                draggable={false}
                priority={Math.abs(i - currentIndex) <= 1}
                sizes="100vw"
                style={{ maxWidth: "100%", maxHeight: "90dvh", width: "auto", height: "auto" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Inline keyframe for swipe hint */}
      <style>{`
        @keyframes fadeOutHint {
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
