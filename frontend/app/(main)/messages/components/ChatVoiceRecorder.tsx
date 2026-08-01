"use client";

import { MaterialIcon } from "../helpers";
import { formatElapsed } from "../utils/voice";
import type { VoiceRecorderState } from "../hooks/useVoiceRecorder";

interface ChatVoiceRecorderProps {
  voice: VoiceRecorderState;
  uploading: boolean;
  onSendVoice: () => void;
  onTranscribeVoice: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
}

export default function ChatVoiceRecorder({
  voice,
  uploading,
  onSendVoice,
  onTranscribeVoice,
  onStopRecording,
  onCancelRecording,
}: ChatVoiceRecorderProps) {
  if (voice.recording) {
    return (
      <div className="flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 border border-primary/30">
        <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
        <span className="font-mono text-body-md text-on-surface tabular-nums">
          {formatElapsed(voice.elapsed)}
        </span>
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

  if (voice.recordedBlob) {
    if (voice.transcribing) {
      return (
        <div className="flex items-center gap-2 bg-secondary/10 rounded-full px-4 py-2 border border-secondary/30">
          <div className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
          <span className="text-body-md text-on-surface font-medium">
            Transcribiendo audio...
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2 border border-outline-variant/30">
        <button
          onClick={voice.isPlaying ? voice.pausePreview : voice.playPreview}
          className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:opacity-90"
          title={voice.isPlaying ? "Pausar" : "Reproducir"}
        >
          <MaterialIcon name={voice.isPlaying ? "pause" : "play_arrow"} className="text-lg" />
        </button>
        <span className="font-mono text-body-md text-on-surface tabular-nums">
          {formatElapsed(voice.elapsed)}
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
          onClick={onTranscribeVoice}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors text-label-sm font-medium disabled:opacity-40"
          title="Convertir audio a texto"
        >
          <MaterialIcon name="speech_to_text" className="text-lg" />
          Transcribir
        </button>
        <button
          onClick={onSendVoice}
          disabled={uploading}
          className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-40"
          title="Enviar audio"
        >
          <MaterialIcon name="send" className="text-lg" />
        </button>
      </div>
    );
  }

  return null;
}
