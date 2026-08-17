"use client";

// Recorte y compresion de videos en el cliente (sin ffmpeg en el servidor).
//
// El video seleccionado se reproduce en un elemento <video> oculto y se
// re-encodea con MediaRecorder a un bitrate bajo (equivalente a la reduccion
// de calidad que sufren las fotos al convertirse a WebP). Solo se sube el
// clip recortado, asi el backend recibe <10MB y no necesita procesar nada.

export const VIDEO_CONSTRAINTS = {
  maxDuration: 30, // segundos maximos del clip publicado
  videoBitsPerSecond: 1_800_000,
  audioBitsPerSecond: 96_000,
  maxSizeBytes: 10 * 1024 * 1024, // limite del backend tras la compresion
} as const;

export interface TrimResult {
  file: File;
  duration: number;
  posterBlob: Blob | null;
}

const RECORDER_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

// iOS Safari no soporta captureStream() sobre elementos de video, asi que no
// se puede recortar ni re-encodear en el dispositivo. El llamador debe usar el
// fallback (subir el original si ya cumple 30s / 10MB).
export function canTrimVideo(): boolean {
  if (typeof document === "undefined") return false;
  const video = document.createElement("video");
  return (
    typeof (video as HTMLVideoElement & { captureStream?: unknown }).captureStream ===
      "function" ||
    typeof (
      video as HTMLVideoElement & { mozCaptureStream?: unknown }
    ).mozCaptureStream === "function"
  );
}

function loadVideoElement(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("No se pudo leer el video"));
  });
}

function waitForSeeked(video: HTMLVideoElement, target: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - target) < 0.05) return resolve();
    video.onseeked = () => resolve();
    video.currentTime = target;
  });
}

export async function getVideoDuration(file: File): Promise<number> {
  const video = await loadVideoElement(file);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  URL.revokeObjectURL(video.src);
  return duration;
}

// Recorta [start, end] y re-encodea el segmento. La grabacion avanza en
// tiempo real: comprimir un clip de 30s tarda ~30s.
export async function trimAndCompressVideo(
  file: File,
  start: number,
  end: number,
  posterAt?: number
): Promise<TrimResult> {
  const mimeType = pickRecorderMimeType();
  if (!mimeType) {
    throw new Error("Este navegador no permite recortar videos");
  }

  const video = await loadVideoElement(file);
  const captureStream = (
    video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    }
  ).captureStream?.() ??
    (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
  if (!captureStream) {
    URL.revokeObjectURL(video.src);
    throw new Error("Este navegador no permite recortar videos");
  }

  const recorder = new MediaRecorder(captureStream, {
    mimeType,
    videoBitsPerSecond: VIDEO_CONSTRAINTS.videoBitsPerSecond,
    audioBitsPerSecond: VIDEO_CONSTRAINTS.audioBitsPerSecond,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  try {
    await waitForSeeked(video, start);
    await video.play();
    recorder.start(250);
    const clipSeconds = Math.max(0.1, end - start);
    await new Promise((resolve) => setTimeout(resolve, clipSeconds * 1000 + 400));
    recorder.stop();
    await stopped;
  } finally {
    video.pause();
    URL.revokeObjectURL(video.src);
  }

  const container = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
  const baseName = (file.name || "video").replace(/\.[^.]+$/, "");
  const videoFile = new File([blob], `${baseName}_trim.${container}`, { type: blob.type });

  // Genera el poster del clip recortado (frame a posterAt o start+0.1s).
  const posterTime = posterAt ?? Math.max(0, start + 0.1);
  const posterBlob = await generateVideoPoster(file, posterTime);

  return {
    file: videoFile,
    duration: Math.max(0.1, end - start),
    posterBlob,
  };
}

// Genera el primer fotograma del clip como poster (webp, con fallback jpeg).
export async function generateVideoPoster(
  file: File,
  atSeconds: number
): Promise<Blob | null> {
  try {
    const video = await loadVideoElement(file);
    await waitForSeeked(video, Math.max(0, atSeconds));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(video.src);
      return null;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(video.src);

    const webp = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8)
    );
    if (webp) return webp;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
  } catch {
    return null;
  }
}