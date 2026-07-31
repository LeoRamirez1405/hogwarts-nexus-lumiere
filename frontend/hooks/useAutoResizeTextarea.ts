"use client";

import { useEffect, useRef, useCallback, useLayoutEffect, useState } from "react";

interface UseAutoResizeTextareaOptions {
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum height in pixels (0 = no limit) */
  maxHeight?: number;
  /** Extra padding at bottom in pixels */
  paddingBottom?: number;
}

/**
 * Hook that auto-resizes a textarea to fit its content.
 * Usage:
 *   const { textareaRef, height } = useAutoResizeTextarea({ minHeight: 80, maxHeight: 300 });
 *   <textarea ref={textareaRef} style={{ height }} />
 */
export function useAutoResizeTextarea(
  options: UseAutoResizeTextareaOptions = {}
) {
  const { minHeight = 80, maxHeight = 0, paddingBottom = 0 } = options;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState(minHeight);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Temporarily set height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight + paddingBottom;
    const clampedHeight = maxHeight > 0
      ? Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      : Math.max(scrollHeight, minHeight);

    setHeight(clampedHeight);
    textarea.style.height = `${clampedHeight}px`;

    // Show/hide scrollbar based on max height
    if (maxHeight > 0 && scrollHeight > maxHeight) {
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.overflowY = "hidden";
    }
  }, [minHeight, maxHeight, paddingBottom]);

  useLayoutEffect(() => {
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resize]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInput = () => resize();
    textarea.addEventListener("input", handleInput);
    return () => textarea.removeEventListener("input", handleInput);
  }, [resize]);

  return { textareaRef, height, resize };
}