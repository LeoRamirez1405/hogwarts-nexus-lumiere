"use client";

import { MaterialIcon } from "../helpers";
import type { VideoRecorderState } from "../hooks/useVideoRecorder";

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ChatVideoRecorderProps {
  video: VideoRecorderState;
  uploading: boolean;
  onSendVideo: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
}

export default function ChatVideoRecorder({
  video,
  uploading,
  onSendVideo,
  onStopRecording,
  onCancelRecording,
}: ChatVideoRecorderProps) {

  if (video.recording) {
    return (
      <div className="flex items-center gap-2 bg-error/10 rounded-full px-4 py-2 border border-error/30">
        <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
        <span className="font-mono text-body-md text-on-surface tabular-nums">
          {formatElapsed(video.elapsed)}
        </span>
        <span className="text-label-sm text-on-surface-variant">Filmando video...</span>
        <div className="flex-1" />
        <button
          onClick={onStopRecording}
          className="w-9 h-9 flex items-center justify-center bg-error text-white rounded-full hover:opacity-90"
          title="Detener grabacion"
        >
          <MaterialIcon name="stop" className="text-lg" />
        </button>
      </div>
    );
  }

  if (video.previewUrl && video.recordedBlob) {
    return (
      <div className="flex items-center gap-2 bg-surface-container rounded-full px-3 py-2 border border-outline-variant/30">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface-container-highest shrink-0 border border-outline-variant/30">
          <video
            src={video.previewUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        </div>
        <span className="font-mono text-body-sm text-on-surface tabular-nums">
          {formatElapsed(video.elapsed)}
        </span>
        <div className="flex-1" />
        <button
          onClick={onCancelRecording}
          className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          title="Cancelar"
        >
          <MaterialIcon name="close" className="text-lg" />
        </button>
        <button
          onClick={onSendVideo}
          disabled={uploading}
          className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-40"
          title="Enviar video"
        >
          <MaterialIcon name="send" className="text-lg" />
        </button>
      </div>
    );
  }

  return null;
}