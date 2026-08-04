"use client";

import { useState, useCallback, useRef } from "react";

export interface VideoRecorderState {
  recording: boolean;
  elapsed: number;
  recordedBlob: Blob | null;
  previewUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cleanup: () => void;
  error: string | null;
  clearError: () => void;
  hasPermission: boolean;
  checkPermission: () => Promise<boolean>;
}

export function useVideoRecorder(): VideoRecorderState {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.src = "";
      previewVideoRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecording(false);
  }, [previewUrl]);

  const checkPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return false;
    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName });
      setHasPermission(status.state === "granted");
      return status.state === "granted";
    } catch {
      return false;
    }
  }, []);

  const getHelpMessage = (errName: string) => {
    switch (errName) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Permiso denegado. Haz clic en el candado 🔒 en la barra de direcciones del navegador y permite 'Cámara' y 'Micrófono' para este sitio. Luego pulsa Reintentar.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No se encontró ninguna cámara o micrófono conectados. Conecta una cámara e inténtalo de nuevo.";
      case "NotReadableError":
      case "TrackStartError":
        return "La cámara o el micrófono están siendo usados por otra aplicación. Cierra las otras apps que usen la cámara (Zoom, Meet, Teams, etc.) e inténtalo de nuevo.";
      default:
        if (typeof window !== "undefined" && window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          return "La cámara requiere una conexión segura (HTTPS). Esta función no funciona en HTTP.";
        }
        return `Error al acceder a la cámara: ${errName}`;
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (status.state === "denied") {
        setError("Permiso de cámara bloqueado. Ve a Ajustes del sitio (candado 🔒 en la barra de direcciones) → Permisos → Cámara → Permitir.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      setHasPermission(true);

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      chunksRef.current = chunks;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = chunks;
      setRecordedBlob(null);
      setPreviewUrl(null);
      setElapsed(0);
      setRecording(true);

      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      recorder.start(1000);
    } catch (error) {
      console.error("Failed to start video recording:", error);
      const err = error as DOMException;
      const message = getHelpMessage(err?.name || "UnknownError");
      setError(message);
      setHasPermission(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        cleanup();
        return;
      }

      recorder.onstop = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setRecording(false);

        const chunks = chunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setRecordedBlob(blob);
          setPreviewUrl(url);
          resolve(blob);
        } else {
          resolve(null);
        }
        chunksRef.current = [];
      };

      recorder.stop();
    });
  }, [cleanup]);

  return {
    recording,
    elapsed,
    recordedBlob,
    previewUrl,
    startRecording,
    stopRecording,
    cleanup,
    error,
    clearError,
    hasPermission,
    checkPermission,
  };
}