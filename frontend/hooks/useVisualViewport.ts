"use client";

import { useEffect, useState } from "react";

export interface VisualViewportState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  viewportHeight: number;
  viewportWidth: number;
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    keyboardHeight: 0,
    isKeyboardOpen: false,
    viewportHeight: typeof window !== "undefined" ? window.visualViewport?.height ?? window.innerHeight : 0,
    viewportWidth: typeof window !== "undefined" ? window.visualViewport?.width ?? window.innerWidth : 0,
  });

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

      setState({
        keyboardHeight,
        isKeyboardOpen,
        viewportHeight,
        viewportWidth,
      });
    };

    visualViewport.addEventListener("resize", handleResize);
    visualViewport.addEventListener("scroll", handleResize);

    handleResize();

    return () => {
      visualViewport.removeEventListener("resize", handleResize);
      visualViewport.removeEventListener("scroll", handleResize);
    };
  }, []);

  return state;
}