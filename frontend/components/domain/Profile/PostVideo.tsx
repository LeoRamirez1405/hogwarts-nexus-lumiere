"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui";
import { mediaSrc } from "@/lib/media";
import { useFullscreenMedia } from "@/components/ui/FullscreenMediaViewer";

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
  onOpenFullscreen?: () => void;
}

export function PostVideo({ src, poster, duration, className, onOpenFullscreen }: PostVideoProps) {
  const [playing, setPlaying] = useState(false);
  const url = mediaSrc(src);
  if (!url) return null;

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-black ${className ?? ""}`}
      onClick={onOpenFullscreen}
      style={{ cursor: onOpenFullscreen ? "pointer" : "default" }}
    >
      <video
        src={url}
        poster={poster ? mediaSrc(poster) : undefined}
        className="w-full max-h-96 bg-black"
        controls
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={(e) => e.stopPropagation()}
      />
      {!playing && duration && duration > 0 && (
        <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/70 text-white text-label-sm font-mono flex items-center gap-1">
          <MaterialIcon name="play_arrow" className="text-sm" />
          {formatDuration(duration)}
        </span>
      )}
      {onOpenFullscreen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <MaterialIcon
            name="fullscreen"
            className="text-white/80 text-3xl drop-shadow-lg hover:text-white transition-colors"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

export function PostVideoWithFullscreen({ src, poster, duration, className }: PostVideoProps) {
  const { open, FullscreenViewer } = useFullscreenMedia();

  return (
    <>
      <PostVideo
        src={src}
        poster={poster}
        duration={duration}
        className={className}
        onOpenFullscreen={() => open({ src, type: "video", poster, alt: "Video" })}
      />
      <FullscreenViewer />
    </>
  );
}