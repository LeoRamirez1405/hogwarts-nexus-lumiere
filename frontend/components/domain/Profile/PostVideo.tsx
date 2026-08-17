"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui";
import { mediaSrc } from "@/lib/media";

function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PostVideoProps {
  src: string;
  poster?: string;
  duration?: number;
  className?: string;
}

export function PostVideo({ src, poster, duration, className }: PostVideoProps) {
  const [playing, setPlaying] = useState(false);
  const url = mediaSrc(src);
  if (!url) return null;

  return (
    <div className={`relative rounded-xl overflow-hidden bg-black ${className ?? ""}`}>
      <video
        src={url}
        poster={poster ? mediaSrc(poster) : undefined}
        className="w-full max-h-96 bg-black"
        controls
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!playing && duration && duration > 0 && (
        <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/70 text-white text-label-sm font-mono flex items-center gap-1">
          <MaterialIcon name="play_arrow" className="text-sm" />
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}