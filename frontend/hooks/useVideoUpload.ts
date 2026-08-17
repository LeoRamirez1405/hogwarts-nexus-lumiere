"use client";

// Selección de video para posts: recorte (>30s), compresión con MediaRecorder
// y subida del clip + poster. Compartido por PostComposer y EditPostModal.

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useFileUpload } from "@/hooks/useFileUpload";
import {
  VIDEO_CONSTRAINTS,
  canTrimVideo,
  getVideoDuration,
  trimAndCompressVideo,
} from "@/lib/video/trim";
import type { TrimResult } from "@/lib/video/trim";

export interface VideoAttachment {
  videoUrl: string;
  posterUrl: string;
  duration: number;
}

export interface UseVideoUploadOptions {
  onReady?: (attachment: VideoAttachment) => void;
}

export function useVideoUpload(options: UseVideoUploadOptions = {}) {
  const onReadyRef = useRef(options.onReady);
  useLayoutEffect(() => {
    onReadyRef.current = options.onReady;
  });

  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { upload: uploadVideoFile, uploading: uploadingVideoFile } = useFileUpload();
  const { upload: uploadPoster, uploading: uploadingPoster } = useFileUpload();

  const uploading = uploadingVideoFile || uploadingPoster;

  const applyAttachment = useCallback((attachment: VideoAttachment) => {
    setVideoUrl(attachment.videoUrl);
    setPosterUrl(attachment.posterUrl);
    setDuration(attachment.duration);
    onReadyRef.current?.(attachment);
  }, []);

  const finalize = useCallback(
    async (trimmed: TrimResult) => {
      const uploads = [uploadVideoFile(trimmed.file)];
      if (trimmed.posterBlob) {
        const posterFile = new File([trimmed.posterBlob], "poster.webp", {
          type: trimmed.posterBlob.type,
        });
        uploads.push(uploadPoster(posterFile));
      }
      const [videoRes, posterRes] = await Promise.all(uploads);
      applyAttachment({
        videoUrl: videoRes?.url ?? "",
        posterUrl: posterRes?.url ?? "",
        duration: trimmed.duration,
      });
    },
    [uploadVideoFile, uploadPoster, applyAttachment]
  );

  const handleSelectFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) return;
      setError(null);

      const fileDuration = await getVideoDuration(file).catch(() => 0);
      if (fileDuration <= 0) {
        setError("No se pudo leer el video, probá con otro archivo.");
        return;
      }

      if (!canTrimVideo()) {
        // iOS Safari no puede recortar ni re-encodear.
        if (fileDuration > VIDEO_CONSTRAINTS.maxDuration) {
          setError(
            "En este dispositivo no se puede recortar el video. Elegí un clip de hasta 30 segundos."
          );
          return;
        }
        if (file.size > VIDEO_CONSTRAINTS.maxSizeBytes) {
          setError("El video pesa más de 10MB. Comprimilo o elegí otro archivo.");
          return;
        }
        const result = await uploadVideoFile(file);
        if (result?.url) {
          applyAttachment({ videoUrl: result.url, posterUrl: "", duration: fileDuration });
        }
        return;
      }

      if (fileDuration <= VIDEO_CONSTRAINTS.maxDuration) {
        const trimmed = await trimAndCompressVideo(file, 0, fileDuration);
        await finalize(trimmed);
      } else {
        setPendingFile(file);
      }
    },
    [uploadVideoFile, applyAttachment, finalize]
  );

  const confirmTrim = useCallback(
    async (trimmed: TrimResult) => {
      setPendingFile(null);
      await finalize(trimmed);
    },
    [finalize]
  );

  const cancelTrim = useCallback(() => setPendingFile(null), []);

  const clear = useCallback(() => {
    setVideoUrl("");
    setPosterUrl("");
    setDuration(0);
    setError(null);
  }, []);

  // Los errores se limpian al cambiar de archivo (el caller decide cómo
  // mostrarlos: toast o texto inline).
  return {
    videoUrl,
    posterUrl,
    duration,
    uploading,
    pendingFile,
    error,
    handleSelectFile,
    confirmTrim,
    cancelTrim,
    clear,
  };
}
