"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { FullscreenMediaViewer } from "./FullscreenMediaViewer";

interface FullscreenMediaContextValue {
  open: (media: { src: string; type: "image" | "video"; poster?: string; alt?: string }) => void;
  close: () => void;
  isOpen: boolean;
  currentMedia: { src: string; type: "image" | "video"; poster?: string; alt?: string } | null;
}

const FullscreenMediaContext = createContext<FullscreenMediaContextValue | null>(null);

export function FullscreenMediaProvider({ children }: { children: ReactNode }) {
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

  return (
    <FullscreenMediaContext.Provider value={{ open, close, isOpen: state.isOpen, currentMedia: state.media }}>
      {children}
      <FullscreenMediaViewer
        isOpen={state.isOpen}
        onClose={close}
        src={state.media?.src ?? ""}
        type={state.media?.type ?? "image"}
        poster={state.media?.poster}
        alt={state.media?.alt}
      />
    </FullscreenMediaContext.Provider>
  );
}

export function useFullscreenMedia() {
  const context = useContext(FullscreenMediaContext);
  if (!context) {
    throw new Error("useFullscreenMedia must be used within a FullscreenMediaProvider");
  }
  return context;
}