"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { MaterialIcon } from "@/components/ui";
import { mediaSrc } from "@/lib/media";
import type { VideoViewProps } from "./types";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoView = ({ message, isOwn, dataSaver, shouldLoad, onLoadClick }: VideoViewProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const thumbnailUrl = (message.metadata as Record<string, unknown> | undefined)?.["thumbnail_url"] as string | undefined;

  const handleLoaded = useCallback(() => {
    // videoRef.duration is Infinity for MediaRecorder webm blobs (no duration
    // metadata) and Infinity is truthy, so `|| metadata` never kicks in. Only
    // trust it when it's a finite, positive number; otherwise use metadata.
    const d = videoRef.current?.duration;
    const meta = Number(message.metadata?.duration) || 0;
    setDuration(Number.isFinite(d) && (d as number) > 0 ? (d as number) : meta);
  }, [message.metadata?.duration]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [playing]);

  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, []);

  const handlePause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, []);

  if (dataSaver && !shouldLoad) {
    return (
      <button
        onClick={onLoadClick}
        className="w-full max-w-sm aspect-video rounded-xl bg-surface-container-high flex flex-col items-center justify-center gap-2 p-4 text-center border border-outline-variant/30 hover:border-primary/50 transition-colors"
        title="Tocar para cargar (modo ahorro de datos activado)"
      >
        <MaterialIcon name="videocam" className="text-4xl text-on-surface-variant" />
        <span className="text-label-sm text-on-surface-variant">Video</span>
        <span className="text-xs text-primary font-medium">Tocar para cargar</span>
      </button>
    );
  }

  const url = mediaSrc(message.attachment_url);
  if (!url) {
    return (
      <span className={`text-label-sm ${isOwn ? "text-white/60" : "text-on-surface-variant"}`}>
        El video ya no esta disponible
      </span>
    );
  }

  const posterUrl = thumbnailUrl ? mediaSrc(thumbnailUrl) : undefined;
  const videoDuration = message.metadata?.duration || 0;
  const displayDuration = duration || videoDuration;
  const progress = displayDuration > 0 ? currentTime / displayDuration * 100 : 0;

  return (
    <div className="relative inline-block rounded-2xl overflow-hidden bg-surface-container-highest border border-outline-variant/20 shadow-xs w-72 sm:w-96 max-w-full aspect-square">
      <video
        ref={videoRef}
        src={url}
        poster={posterUrl}
        preload="metadata"
        playsInline
        controls={false}
        className="absolute inset-0 w-full h-full object-cover cursor-pointer"
        onLoadedMetadata={handleLoaded}
        onEnded={handleEnded}
        onClick={handlePause}
      />

      {!playing && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 hover:bg-black/40 transition-colors z-10"
          aria-label="Reproducir video"
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
              isOwn ? "bg-white/90" : "bg-primary/90"
            }`}
          >
            <MaterialIcon
              name="play_arrow"
              className={`text-2xl ${isOwn ? "text-primary" : "text-white"}`}
            />
          </div>
          {displayDuration > 0 && (
            <span className={`mt-2 text-label-sm font-mono ${isOwn ? "text-white/70" : "text-on-surface/70"}`}>
              {formatDuration(displayDuration)}
            </span>
          )}
        </button>
      )}

      {playing && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 z-10 flex items-center gap-2">
          <button onClick={handlePause} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
            <MaterialIcon name="pause" className="text-white text-lg" />
          </button>
          <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <span className="text-xs font-mono text-white/80 min-w-[40px] text-right">
            {formatDuration(currentTime)}
          </span>
          <a
            href={url}
            download
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title="Descargar"
            onClick={(e) => e.stopPropagation()}
          >
            <MaterialIcon name="download" className="text-white text-sm" />
          </a>
        </div>
      )}
    </div>
  );
};