"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, BottomSheet, Button, MaterialIcon } from "@/components/ui";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";
import {
  VIDEO_CONSTRAINTS,
  TrimResult,
  getVideoDuration,
  trimAndCompressVideo,
} from "@/lib/video/trim";

const MIN_CLIP_SECONDS = 1;
const HANDLE_SIZE = 20;

export type VideoTrimResult = TrimResult;

interface VideoTrimModalProps {
  file: File;
  onCancel: () => void;
  onConfirm: (result: VideoTrimResult) => void;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Extract clientX from mouse or touch event
function getClientX(e: MouseEvent | TouchEvent): number {
  return "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
}

export function VideoTrimModal({ file, onCancel, onConfirm }: VideoTrimModalProps) {
  const isDesktop = useIsDesktopMdUp(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Use refs for values needed in event handlers (avoid stale closures)
  const draggingWhichRef = useRef<"start" | "end" | null>(null);
  const windowDurationRef = useRef<number>(VIDEO_CONSTRAINTS.maxDuration);
  const [draggingWhich, setDraggingWhich] = useState<"start" | "end" | null>(null);

  // Sync ref with state for rendering (transform scale)
  useEffect(() => {
    draggingWhichRef.current = draggingWhich;
  }, [draggingWhich]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let cancelled = false;
    getVideoDuration(file)
      .then((d) => {
        if (cancelled) return;
        if (d <= 0) {
          setLoadError(true);
          return;
        }
        setDuration(d);
        const initialEnd = Math.min(d, VIDEO_CONSTRAINTS.maxDuration);
        setEnd(initialEnd);
        if (!cancelled) setVideoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      setCurrentTime(v.currentTime);
      if (v.currentTime >= end) {
        v.pause();
        setPlaying(false);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [playing, end]);

  const handlePlaySegment = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = start;
    v.play().catch(() => {});
    setPlaying(true);
  };

  const handlePause = () => {
    videoRef.current?.pause();
    setPlaying(false);
  };

  const timeToPercent = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  const percentToTime = (p: number) => (p / 100) * duration;

  // --- Unified drag handlers (mouse + touch) ---
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    const which = draggingWhichRef.current;
    if (!which || !trackRef.current) return;
    e.preventDefault(); // prevent scrolling while dragging
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((getClientX(e) - rect.left) / rect.width) * 100));
    const t = percentToTime(percent);

    if (which === "start") {
      const windowDur = windowDurationRef.current;
      const maxStart = Math.max(0, duration - windowDur);
      const newStart = Math.max(0, Math.min(t, maxStart));
      setStart(newStart);
      // Sliding window: end ALWAYS follows start to maintain fixed duration
      setEnd(newStart + windowDur);
      const v = videoRef.current;
      if (v && !playing) v.currentTime = newStart;
    } else if (which === "end") {
      const minEnd = start + MIN_CLIP_SECONDS;
      const maxEnd = Math.min(start + VIDEO_CONSTRAINTS.maxDuration, duration);
      const newEnd = Math.max(minEnd, Math.min(t, maxEnd));
      setEnd(newEnd);
      const v = videoRef.current;
      if (v && !playing) v.currentTime = newEnd;
    }
  }, [duration, end, start, playing]);

  const handleUp = () => {
    draggingWhichRef.current = null;
    setDraggingWhich(null);
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);
    window.removeEventListener("touchmove", handleMove);
    window.removeEventListener("touchend", handleUp);
    window.removeEventListener("touchcancel", handleUp);
  };

  const handleStartDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingWhichRef.current = "start";
    windowDurationRef.current = end - start;
    setDraggingWhich("start");
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);
  }, [end, start, handleMove, handleUp]);

  const handleEndDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingWhichRef.current = "end";
    setDraggingWhich("end");
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);
  }, [handleMove, handleUp]);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingWhichRef.current) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const t = percentToTime(percent);
    if (Math.abs(t - start) < Math.abs(t - end)) {
      const windowDur = windowDurationRef.current;
      const maxStart = Math.max(0, duration - windowDur);
      const newStart = Math.max(0, Math.min(t, maxStart));
      setStart(newStart);
      setEnd(newStart + windowDur);
      const v = videoRef.current;
      if (v && !playing) v.currentTime = newStart;
    } else {
      const minEnd = start + MIN_CLIP_SECONDS;
      const maxEnd = Math.min(start + VIDEO_CONSTRAINTS.maxDuration, duration);
      const newEnd = Math.max(minEnd, Math.min(t, maxEnd));
      setEnd(newEnd);
      const v = videoRef.current;
      if (v && !playing) v.currentTime = newEnd;
    }
  }, [start, end, duration, playing]);

  const handleConfirm = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await trimAndCompressVideo(file, start, end);
      onConfirm(result);
    } catch {
      setProcessing(false);
    }
  }, [file, start, end, processing, onConfirm]);

  const clipDuration = end - start;
  const previewProgress = duration > 0 ? ((currentTime - start) / clipDuration) * 100 : 0;
  const startPercent = timeToPercent(start);
  const endPercent = timeToPercent(end);

  const renderBody = () => (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            playsInline
            preload="auto"
            onClick={playing ? handlePause : handlePlaySegment}
          />
        )}
        <button
          onClick={playing ? handlePause : handlePlaySegment}
          className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors"
          aria-label={playing ? "Pausar" : "Reproducir segmento"}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary/90 shadow-lg">
            <MaterialIcon name={playing ? "pause" : "play_arrow"} className="text-2xl text-white" />
          </div>
        </button>
        {duration > 0 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-label-sm font-mono">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        )}
        {playing && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
            <div className="h-full bg-secondary" style={{ width: `${Math.max(0, Math.min(100, previewProgress))}%` }} />
          </div>
        )}
      </div>

      {loadError ? (
        <p className="text-body-md text-error">No se pudo leer el video. Probá con otro archivo.</p>
      ) : duration > 0 ? (
        <>
          <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
            <span style={{ color: "#0e3b60" }}>● Inicio: {formatDuration(start)}</span>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono">
              {formatDuration(clipDuration)} / {VIDEO_CONSTRAINTS.maxDuration}s máx
            </span>
            <span style={{ color: "#775a19" }}>● Fin: {formatDuration(end)}</span>
          </div>

          <div className="relative" style={{ height: 36 }}>
            <div
              ref={trackRef}
              className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 rounded-full bg-secondary-container/30"
              onClick={handleTrackClick}
            >
              <div
                className="absolute top-0 h-full rounded-full bg-primary/20"
                style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
              />
            </div>

            {/* Start handle - primary blue, ON the line, smaller, no icon */}
            <button
              type="button"
              className="absolute -translate-x-1/2 rounded-full border-2 border-white shadow-lg z-10 transition-transform"
              style={{
                left: `${startPercent}%`,
                top: "50%",
                transform: draggingWhich === "start"
                  ? "translate(-50%, -50%) scale(1.2)"
                  : "translate(-50%, -50%)",
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: "#0e3b60",
              }}
              onMouseDown={handleStartDown}
              onTouchStart={handleStartDown}
              disabled={processing}
              aria-label={`Inicio del clip: ${formatDuration(start)}`}
            />

            {/* End handle - secondary gold, ON the line, smaller, no icon */}
            <button
              type="button"
              className="absolute -translate-x-1/2 rounded-full border-2 border-white shadow-lg z-10"
              style={{
                left: `${endPercent}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: "#775a19",
              }}
              onMouseDown={handleEndDown}
              onTouchStart={handleEndDown}
              disabled={processing}
              aria-label={`Fin del clip: ${formatDuration(end)}`}
            />
          </div>

          <p className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <MaterialIcon name="content_cut" className="text-base text-secondary" />
            Arrastra el círculo azul (inicio) o dorado (fin). Si acercas el inicio al fin, este se empuja.
          </p>
        </>
      ) : (
        <div className="flex items-center justify-center py-6">
          <MaterialIcon name="progress_activity" className="text-3xl text-outline-variant animate-spin" />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={processing}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon="content_cut"
          onClick={handleConfirm}
          disabled={processing || loadError || duration <= 0}
        >
          {processing ? "Comprimiendo..." : "Recortar y subir"}
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Modal open onClose={() => !processing && onCancel()} title="Recortar video" size="md">
        {renderBody()}
      </Modal>
    );
  }

  return (
    <BottomSheet open onClose={() => !processing && onCancel()} title="Recortar video">
      {renderBody()}
    </BottomSheet>
  );
}