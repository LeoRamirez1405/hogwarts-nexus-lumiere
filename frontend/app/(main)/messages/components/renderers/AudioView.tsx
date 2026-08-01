"use client";

import { MaterialIcon } from "@/components/ui";
import { mediaSrc } from "@/lib/media";
import type { AudioViewProps } from "./types";

export const AudioView = ({ url, dataSaver, shouldLoad, onLoadClick }: AudioViewProps) => {
  if (dataSaver && !shouldLoad) {
    return (
      <button
        onClick={onLoadClick}
        className="w-full aspect-video rounded-xl bg-surface-container-high flex flex-col items-center justify-center gap-2 p-4 text-center border border-outline-variant/30 hover:border-primary/50 transition-colors"
        title="Tocar para cargar (modo ahorro de datos activado)"
      >
        <MaterialIcon name="music_note" className="text-4xl text-on-surface-variant" />
        <span className="text-label-sm text-on-surface-variant">Audio</span>
        <span className="text-xs text-primary font-medium">Tocar para cargar</span>
      </button>
    );
  }

  return <audio src={mediaSrc(url)} controls className="w-full mt-1" />;
};