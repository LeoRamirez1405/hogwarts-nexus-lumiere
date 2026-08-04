"use client";

import { useState, useEffect, useRef } from "react";
import { MaterialIcon } from "@/components/ui";
import type { VoiceViewProps } from "./types";

export const VoiceView = ({ message, isOwn }: VoiceViewProps) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // webm blobs recorded by MediaRecorder ship without duration metadata, so
  // audio.duration reads as Infinity. Start from the duration we stored at
  // record time and only trust audio.duration when it's a real number.
  const [duration, setDuration] = useState(() => {
    const meta = Number(message.metadata?.duration);
    return Number.isFinite(meta) && meta > 0 ? meta : 0;
  });
  const [currentTime, setCurrentTime] = useState(0);

  const transcription = message.metadata?.transcription;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    if (!message.attachment_url) return;
    const audio = new Audio(message.attachment_url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => setPlaying(false);
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [message.attachment_url, message.metadata?.duration]);

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-xl ${
        isOwn ? "bg-white/15" : "bg-surface-container-high border border-outline-variant/20"
      }`}
    >
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isOwn ? "bg-white text-primary" : "bg-primary text-on-primary"
        }`}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        <MaterialIcon name={playing ? "pause" : "play_arrow"} className="text-xl" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-2 rounded-full relative overflow-hidden ${isOwn ? "bg-white/20" : "bg-surface-container-highest"}`}>
            <div
              className={`h-full rounded-full transition-all ${isOwn ? "bg-white/70" : "bg-primary/60"}`}
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
          </div>
          <span className={`text-label-sm font-mono w-12 text-right ${isOwn ? "text-white/80" : "text-on-surface-variant"}`}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        {transcription && (
          <p className={`text-label-sm mt-1 italic max-h-16 overflow-hidden text-ellipsis ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>
            {transcription}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {transcription && (
          <button
            className={`p-1 rounded-full transition-colors ${isOwn ? "hover:bg-white/20 text-white/70" : "hover:bg-surface-container-highest text-on-surface-variant"}`}
            title="Copiar transcripcion"
          >
            <MaterialIcon name="content_copy" className="text-lg" />
          </button>
        )}
        <a
          href={message.attachment_url}
          download
          className={`p-1 rounded-full transition-colors ${isOwn ? "hover:bg-white/20 text-white/70" : "hover:bg-surface-container-highest text-on-surface-variant"}`}
        >
          <MaterialIcon name="download" className="text-lg" />
        </a>
      </div>
    </div>
  );
};