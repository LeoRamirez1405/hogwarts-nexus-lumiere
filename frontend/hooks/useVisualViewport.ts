"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface VisualViewportState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  viewportHeight: number;
  viewportWidth: number;
  offsetTop: number;
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    keyboardHeight: 0,
    isKeyboardOpen: false,
    viewportHeight: typeof window !== "undefined" ? window.visualViewport?.height ?? window.innerHeight : 0,
    viewportWidth: typeof window !== "undefined" ? window.visualViewport?.width ?? window.innerWidth : 0,
    offsetTop: 0,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 150;

  const debouncedSetState = useCallback((newState: VisualViewportState) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setState(newState);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const visualViewport = window.visualViewport;

    const handleResize = () => {
      const viewportHeight = visualViewport.height;
      const viewportWidth = visualViewport.width;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;
      const isKeyboardOpen = keyboardHeight > 50;

      debouncedSetState({
        keyboardHeight,
        isKeyboardOpen,
        viewportHeight,
        viewportWidth,
        offsetTop: visualViewport.offsetTop,
      });
    };

    visualViewport.addEventListener("resize", handleResize);
    visualViewport.addEventListener("scroll", handleResize);

    handleResize();

    return () => {
      visualViewport.removeEventListener("resize", handleResize);
      visualViewport.removeEventListener("scroll", handleResize);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [debouncedSetState]);

  return state;
}