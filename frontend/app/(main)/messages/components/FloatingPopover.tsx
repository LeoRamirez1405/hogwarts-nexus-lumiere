"use client";

import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface FloatingPopoverProps {
  anchorRef?: React.RefObject<HTMLElement | null>;
  clientX?: number;
  clientY?: number;
  lineHeight?: number;
  open: boolean;
  children: React.ReactNode;
  className?: string;
  placement?: "left" | "right" | "top" | "bottom";
  align?: "start" | "center" | "end";
  gap?: number;
  onRequestClose?: (open: boolean) => void;
  maxHeight?: number;
  maxWidth?: number;
  closeDelay?: number;
}

function resolveDirection(
  preferred: "left" | "right" | "top" | "bottom",
  anchorRect: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  gap: number,
  vw: number,
  vh: number
): "left" | "right" | "top" | "bottom" {
  const spaceLeft = anchorRect.left;
  const spaceRight = vw - anchorRect.right;
  const spaceAbove = anchorRect.top;
  const spaceBelow = vh - anchorRect.bottom;

  const fitsLeft = spaceLeft >= popoverWidth + gap;
  const fitsRight = spaceRight >= popoverWidth + gap;
  const fitsAbove = spaceAbove >= popoverHeight + gap;
  const fitsBelow = spaceBelow >= popoverHeight + gap;

  if (preferred === "left" && fitsLeft) return "left";
  if (preferred === "left" && fitsRight) return "right";

  if (preferred === "right" && fitsRight) return "right";
  if (preferred === "right" && fitsLeft) return "left";

  if (preferred === "top" && fitsAbove) return "top";
  if (preferred === "top" && fitsBelow) return "bottom";

  if (preferred === "bottom" && fitsBelow) return "bottom";
  if (preferred === "bottom" && fitsAbove) return "top";

  return preferred;
}

export function FloatingPopover({
  anchorRef,
  clientX,
  clientY,
  lineHeight,
  open,
  children,
  className = "",
  placement = "right",
  align = "center",
  gap = 8,
  onRequestClose,
  maxHeight = 400,
  maxWidth = 360,
  closeDelay = 150,
}: FloatingPopoverProps) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isHoveringPopoverRef = useRef(false);
  const isHoveringAnchorRef = useRef(false);

  const updatePosition = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    const contentRect = content.getBoundingClientRect();
    const measuredHeight = contentRect.height;
    if (measuredHeight < 20) return;
    const measuredWidth = contentRect.width;

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let anchorRect: DOMRect;

    if (clientX !== undefined && clientY !== undefined) {
      const lh = lineHeight || 24;
      anchorRect = {
        left: clientX,
        right: clientX,
        top: clientY,
        bottom: clientY + lh,
        width: 0,
        height: lh,
        x: clientX,
        y: clientY,
        toJSON: () => {},
      } as DOMRect;
    } else if (anchorRef?.current) {
      anchorRect = anchorRef.current.getBoundingClientRect();
    } else {
      return;
    }

    const dir = resolveDirection(placement, anchorRect, measuredWidth, measuredHeight, gap, vw, vh);

    let top = 0;
    let left = 0;

    if (dir === "left" || dir === "right") {
      if (align === "start") {
        top = anchorRect.top;
      } else if (align === "end") {
        top = anchorRect.bottom - measuredHeight;
      } else {
        top = anchorRect.top + anchorRect.height / 2 - measuredHeight / 2;
      }
    } else {
      if (align === "start") {
        left = anchorRect.left;
      } else if (align === "end") {
        left = anchorRect.right - measuredWidth;
      } else {
        left = anchorRect.left + anchorRect.width / 2 - measuredWidth / 2;
      }
    }

    if (dir === "left") {
      left = anchorRect.left - measuredWidth - gap;
    } else if (dir === "right") {
      left = anchorRect.right + gap;
    } else if (dir === "top") {
      top = anchorRect.top - measuredHeight - gap;
    } else {
      top = anchorRect.bottom + gap;
    }

    left = Math.max(gap, Math.min(left, vw - measuredWidth - gap));
    top = Math.max(gap, Math.min(top, vh - measuredHeight - gap));

    setPosition({ top, left, width: measuredWidth, height: measuredHeight });
  }, [anchorRef, clientX, clientY, lineHeight, placement, align, gap]);

  const requestClose = useCallback(() => {
    onRequestClose?.(false);
  }, [onRequestClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      updatePosition();
    });
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const content = contentRef.current;
      const anchor = anchorRef?.current;
      const target = e.target as Node | null;
      const insideOtherPopover =
        target instanceof Element &&
        target.closest("[data-floating-popover='true']") !== null;
      if (
        !insideOtherPopover &&
        content && !content.contains(e.target as Node) &&
        anchor && !anchor.contains(e.target as Node)
      ) {
        requestClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, anchorRef, requestClose]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, requestClose]);

  const handleAnchorMouseEnter = useCallback(() => {
    isHoveringAnchorRef.current = true;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleAnchorMouseLeave = useCallback(() => {
    isHoveringAnchorRef.current = false;
    if (closeTimerRef.current) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (!isHoveringAnchorRef.current && !isHoveringPopoverRef.current) {
        requestClose();
      }
    }, closeDelay);
  }, [requestClose, closeDelay]);

  const handlePopoverMouseEnter = useCallback(() => {
    isHoveringPopoverRef.current = true;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handlePopoverMouseLeave = useCallback(() => {
    isHoveringPopoverRef.current = false;
    if (closeTimerRef.current) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (!isHoveringAnchorRef.current && !isHoveringPopoverRef.current) {
        requestClose();
      }
    }, closeDelay);
  }, [requestClose, closeDelay]);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef?.current;
    if (!anchor) return;

    if (anchor.matches(":hover")) {
      isHoveringAnchorRef.current = true;
    }

    anchor.addEventListener("mouseenter", handleAnchorMouseEnter);
    anchor.addEventListener("mouseleave", handleAnchorMouseLeave);
    return () => {
      anchor.removeEventListener("mouseenter", handleAnchorMouseEnter);
      anchor.removeEventListener("mouseleave", handleAnchorMouseLeave);
    };
  }, [open, anchorRef, handleAnchorMouseEnter, handleAnchorMouseLeave]);

  if (!open) return null;

  const visible = position !== null;

  return createPortal(
    <div
      ref={contentRef}
      data-floating-popover={open ? "true" : undefined}
      className={`fixed z-[9999] bg-surface-container-highest rounded-xl shadow-xl py-2 px-3 overflow-y-auto no-scrollbar ${className}`}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width ?? "auto",
        maxHeight: maxHeight,
        maxWidth: maxWidth,
        visibility: visible ? "visible" : "hidden",
      }}
      onMouseEnter={handlePopoverMouseEnter}
      onMouseLeave={handlePopoverMouseLeave}
    >
      {children}
    </div>,
    document.body
  );
}