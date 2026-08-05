"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSwipeable } from "@/hooks/useGestures";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { MaterialIcon } from "./MaterialIcon";
import { useHapticLight } from "@/hooks/useHapticFeedback";

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
  const { isKeyboardOpen, viewportHeight, offsetTop } = useVisualViewport();
  const hapticLight = useHapticLight();

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
    hapticLight();
    setAnimOut(true);
    setTimeout(() => {
      setAnimOut(false);
      onClose();
    }, 200);
  }, [onClose, hapticLight]);

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

  // When a field inside the sheet is focused, make sure it is scrolled into the
  // visible area above the keyboard. The sheet itself is sized to the visual
  // viewport (see below), so a plain scrollIntoView within the scroll area is
  // enough — we don't fight the browser with transforms.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !panel.contains(target)) return;
      // Wait for the keyboard/viewport to settle before scrolling.
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300);
    };
    panel.addEventListener("focusin", handleFocusIn);
    return () => panel.removeEventListener("focusin", handleFocusIn);
  }, [open]);

  if (!visible && !open) return null;
  if (typeof window === "undefined") return null;

  // Instead of translating the whole sheet up (which breaks native scroll-into
  // -view and position:fixed on mobile), we shrink the overlay to the visual
  // viewport box. The panel stays anchored to the bottom of that box, landing
  // exactly on top of the keyboard, and its inner scroll area handles overflow.
  const overlayStyle: React.CSSProperties =
    isKeyboardOpen && viewportHeight > 0
      ? { top: `${offsetTop}px`, height: `${viewportHeight}px`, bottom: "auto" }
      : {};
  const maxHeight = isKeyboardOpen && viewportHeight > 0 ? "100%" : "85dvh";

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-200 ${
        open && !animOut ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: open && !animOut ? "auto" : "none", ...overlayStyle }}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        className={`absolute bottom-0 left-0 right-0 bg-surface-container-lowest rounded-t-2xl shadow-2xl flex flex-col outline-none transition-transform duration-200 ease-out ${
          open && !animOut ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          maxHeight,
          transform: open && !animOut ? "translateY(0)" : "translateY(100%)",
        }}
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