"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui";
import { mediaSrc } from "@/lib/media";

interface FullscreenMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  type: "image" | "video";
  poster?: string;
  alt?: string;
}

export function FullscreenMediaViewer({
  isOpen,
  onClose,
  src,
  type,
  poster,
  alt = "",
}: FullscreenMediaViewerProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      setDragOffset(delta);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragOffset > 100) {
      onClose();
    } else {
      setDragOffset(0);
    }
  }, [dragOffset, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const normalizedSrc = mediaSrc(src);
  const normalizedPoster = poster ? mediaSrc(poster) : undefined;

  const contentStyle: React.CSSProperties = {
    transform: `translateY(${dragOffset}px)`,
    opacity: Math.max(0, 1 - dragOffset / 500),
    borderRadius: dragOffset > 0 ? "1.5rem" : "0.75rem",
    transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, border-radius 0.3s ease",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={type === "image" ? "Vista previa de imagen" : "Vista previa de video"}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={elementRef}
        className="relative w-full max-w-[90vw] max-h-[90vh] p-4"
        style={contentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 z-10 w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Cerrar"
        >
          <MaterialIcon name="close" className="text-xl" />
        </button>

        {type === "image" ? (
          <img
            src={normalizedSrc}
            alt={alt}
            className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <video
            src={normalizedSrc}
            poster={normalizedPoster}
            className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl"
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

interface UseFullscreenMediaReturn {
  isOpen: boolean;
  media: { src: string; type: "image" | "video"; poster?: string; alt?: string } | null;
  open: (media: { src: string; type: "image" | "video"; poster?: string; alt?: string }) => void;
  close: () => void;
  FullscreenViewer: React.FC;
}

export function useFullscreenMedia(): UseFullscreenMediaReturn {
  const [state, setState] = useState<{
    isOpen: boolean;
    media: { src: string; type: "image" | "video"; poster?: string; alt?: string } | null;
  }>({ isOpen: false, media: null });

  const open = useCallback(
    (media: { src: string; type: "image" | "video"; poster?: string; alt?: string }) => {
      setState({ isOpen: true, media });
    },
    []
  );

  const close = useCallback(() => {
    setState({ isOpen: false, media: null });
  }, []);

  const Viewer = useCallback(
    () => (
      <FullscreenMediaViewer
        isOpen={state.isOpen}
        onClose={close}
        src={state.media?.src ?? ""}
        type={state.media?.type ?? "image"}
        poster={state.media?.poster}
        alt={state.media?.alt}
      />
    ),
    [state.isOpen, state.media, close]
  );

  return { isOpen: state.isOpen, media: state.media, open, close, FullscreenViewer: Viewer };
}