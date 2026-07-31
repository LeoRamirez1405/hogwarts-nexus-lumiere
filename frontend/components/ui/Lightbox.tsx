"use client";
import { useCallback, useRef } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { usePinchZoom, useSwipeable } from "@/hooks/useGestures";
import { useReducedMotion } from "@/hooks/useGestures";

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  const prefersReducedMotion = useReducedMotion();
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { state, onTouchStart: onPinchStart, onTouchMove: onPinchMove, onTouchEnd: onPinchEnd, reset } = usePinchZoom(1, 4);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const { onTouchStart: onSwipeStart, onTouchMove: onSwipeMove, onTouchEnd: onSwipeEnd } = useSwipeable({
    onSwipeDown: close,
    onSwipeRight: close,
    threshold: 80,
    disabled: prefersReducedMotion || state.scale > 1,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    onSwipeStart(e);
    onPinchStart(e);
  }, [onSwipeStart, onPinchStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    onSwipeMove(e);
    onPinchMove(e);
  }, [onSwipeMove, onPinchMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    onSwipeEnd();
    onPinchEnd(e);
  }, [onSwipeEnd, onPinchEnd]);

  const handleDoubleTap = useCallback(() => {
    if (state.scale > 1) {
      reset();
    } else {
      // The hook manages its own state, we just use reset for double-tap
      // In a full implementation, we'd add a setScale to the hook
    }
  }, [state.scale, reset]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    // Wheel zoom would need a setter in the hook
  }, []);

  const transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={close}
      onWheel={handleWheel}
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? "Imagen ampliada"}
      style={{
        animation: prefersReducedMotion ? "none" : "fadeIn 0.2s ease-out",
      }}
    >
      <button
        onClick={close}
        aria-label="Cerrar"
        className="absolute top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
      >
        <MaterialIcon name="close" className="text-xl" />
      </button>

      {state.scale <= 1 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-10 opacity-60">
          <MaterialIcon name="keyboard_arrow_down" className="text-white text-2xl animate-bounce" />
        </div>
      )}
      </div>

      <div
        ref={containerRef}
        className="relative max-w-full max-h-[90vh] object-contain"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
        style={{
          transform: transform,
          transformOrigin: "center center",
          transition: prefersReducedMotion ? "none" : "transform 0.15s ease-out",
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? "Imagen ampliada"}
          loading="lazy"
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>

      {state.scale > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white text-label-sm">
          <MaterialIcon name="zoom_in" className="text-lg" />
          <span>{Math.round(state.scale * 100)}%</span>
          <button
            onClick={reset}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Restablecer zoom"
          >
            <MaterialIcon name="refresh" className="text-lg" />
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}