"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSwipeable } from "@/hooks/useGestures";
import { MaterialIcon } from "./MaterialIcon";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  ariaLabel,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  const [animOut, setAnimOut] = useState(false);

  const swipeHandlers = useSwipeable({
    onSwipeDown: () => {
      setAnimOut(true);
      setTimeout(() => {
        setAnimOut(false);
        onClose();
      }, 200);
    },
    threshold: 60,
    preventScroll: false,
  });

  const handleClose = useCallback(() => {
    setAnimOut(true);
    setTimeout(() => {
      setAnimOut(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setVisible(true), 0);
    const focusT = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(focusT);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => setVisible(false), 200);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  if (!visible && !open) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-200 ${
        open && !animOut ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: open && !animOut ? "auto" : "none" }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        className={`absolute bottom-0 left-0 right-0 bg-surface-container-lowest rounded-t-2xl shadow-2xl max-h-[85dvh] flex flex-col outline-none transition-transform duration-200 ease-out ${
          open && !animOut ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}
        onMouseDown={swipeHandlers.onMouseDown}
        onMouseMove={swipeHandlers.onMouseMove}
        onMouseUp={swipeHandlers.onMouseUp}
        onMouseLeave={swipeHandlers.onMouseLeave}
      >
        <div
          className="flex items-center justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1.5 rounded-full bg-outline-variant" />
        </div>

        {title && (
          <div className="flex items-center justify-between px-6 pb-3 shrink-0">
            <h2 id={titleId} className="text-title-md font-medium text-on-surface">
              {title}
            </h2>
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <MaterialIcon name="close" className="text-[1.2em]" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-6 no-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}