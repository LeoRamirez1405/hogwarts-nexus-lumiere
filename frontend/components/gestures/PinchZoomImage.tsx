"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui";
import { usePinchZoom } from "@/hooks/useGestures";
import { useReducedMotion } from "@/hooks/useGestures";

interface PinchZoomImageProps {
  src: string;
  alt?: string;
  onClose: () => void;
  initialScale?: number;
}

export function PinchZoomImage({ src, alt, onClose, initialScale = 1 }: PinchZoomImageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { state, onTouchStart, onTouchMove, onTouchEnd, reset } = usePinchZoom(1, 4);

  const close = useCallback(() => {
    setIsOpen(false);
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [close]);

  const handleDoubleTap = useCallback(() => {
    if (state.scale > 1) {
      reset();
    } else {
      // Using reset to go back to 1, or we could set scale to 2
      // The hook doesn't expose a setter, so we just reset for now
      reset();
    }
  }, [state.scale, reset]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    // Note: PinchZoom doesn't expose a setter, wheel zoom would need a custom state
  }, []);

  if (!isOpen) return null;

  const transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;

  return createPortal(
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

      <div
        ref={containerRef}
        className="relative max-w-full max-h-[90vh] object-contain"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={handleDoubleTap}
        style={{
          transform: transform,
          transformOrigin: "center center",
          transition: prefersReducedMotion ? "none" : "transform 0.15s ease-out",
          willChange: "transform",
        }}
      >
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
    </div>,
    document.body
  );
}