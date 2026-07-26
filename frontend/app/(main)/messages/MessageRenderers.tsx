"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Message } from "@/lib/api";
import {
  MaterialIcon,
  formatMessageTime,
  getFileIcon,
  formatFileSize,
} from "./helpers";

export function PollView({
  poll,
  isOwn,
}: {
  poll: Message["poll"];
  isOwn: boolean;
}) {
  if (!poll) return null;

  const totalVotes = poll.total_votes;

  return (
    <div
      className={`mt-2 p-3 rounded-xl ${
        isOwn
          ? "bg-on-primary-container/10"
          : "bg-surface-container-high"
      } border border-outline-variant/20`}
    >
      <p className="text-body-md font-medium text-on-surface mb-2">
        {poll.question}
    </p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct =
            totalVotes > 0 ? (opt.votes_count / totalVotes) * 100 : 0;
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <div
                className={`flex-1 h-8 rounded-full transition-all ${
                  opt.voted_by_me
                    ? "bg-primary"
                    : "bg-surface-container-highest"
                }`}
                style={{ width: `${pct}%`, minWidth: "60px" }}
              >
                <span
                  className={`flex items-center justify-end pr-2 text-label-sm h-full ${
                    opt.voted_by_me
                      ? "text-on-primary"
                      : "text-on-surface-variant"
                  }`}
                >
                  {opt.label}
              </span>
            </div>
              <div className="w-16 text-right text-label-sm text-on-surface-variant">
                {opt.votes_count}{" "}
                {totalVotes > 0 ? `(${Math.round(pct)}%)` : ""}
            </div>
          </div>
          );
        })}
    </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/20">
        <span className="text-label-sm text-on-surface-variant">
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
      </span>
        {poll.multi_choice && (
          <span className="text-label-sm text-primary">
            Múltiple opción
        </span>
        )}
    </div>
  </div>
  );
}

export function StickerView({ sticker }: { sticker: string }) {
  return (
    <div className="text-6xl select-none" style={{ lineHeight: 1 }}>
      {sticker}
  </div>
  );
}

export function VoiceView({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
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
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => setPlaying(false);
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [message.attachment_url]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-xl ${
        isOwn ? "bg-primary-container/30" : "bg-surface-container-high"
      }`}
    >
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isOwn
            ? "bg-primary text-on-primary"
            : "bg-surface-container-highest text-on-surface"
        }`}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        <MaterialIcon
          name={playing ? "pause" : "play_arrow"}
          className="text-xl"
        />
    </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-surface-container-highest relative overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all"
              style={{
                width: `${
                  duration > 0 ? (currentTime / duration) * 100 : 0
                }%`,
              }}
           />
        </div>
          <span className="text-label-sm text-on-surface-variant font-mono w-12 text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
        {transcription && (
          <p className="text-label-sm text-on-surface-variant/80 mt-1 italic max-h-16 overflow-hidden text-ellipsis">
            {transcription}
          </p>
        )}
    </div>
      <div className="flex items-center gap-2">
        {transcription && (
          <button
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            title="Copiar transcripción"
          >
            <MaterialIcon name="content_copy" className="text-lg" />
        </button>
        )}
        <a
          href={message.attachment_url}
          download
          className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <MaterialIcon name="download" className="text-lg" />
      </a>
    </div>
  </div>
  );
}

export function DocumentView({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const icon = getFileIcon(message.attachment_type || "");
  const name = message.attachment_name || "Documento";
  const size = message.metadata?.size
    ? formatFileSize(message.metadata.size)
    : "";

  return (
    <a
      href={message.attachment_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl ${
        isOwn
          ? "bg-primary-container/30"
          : "bg-surface-container-high"
      } border border-outline-variant/20 w-fit`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
          isOwn
            ? "bg-primary/20 text-primary"
            : "bg-surface-container-highest text-on-surface-variant"
        }`}
      >
        <MaterialIcon name={icon} className="text-2xl" />
    </div>
      <div className="min-w-0">
        <p className="text-body-md text-on-surface truncate max-w-xs">{name}</p>
        <p className="text-label-sm text-on-surface-variant">{size}</p>
    </div>
      <MaterialIcon name="open_in_new" className="text-on-surface-variant" />
  </a>
  );
}

export function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const kind = message.kind || "text";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 gap-2`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" />
      </div>
      )}
      <div
        className={`px-4 py-2.5 max-w-[70%] ${
          isOwn
            ? "bg-primary-container text-on-primary-container rounded-2xl rounded-tr-none"
            : "bg-surface-container-high text-on-surface rounded-2xl rounded-tl-none parchment-message"
        }`}
      >
        {kind === "poll" && message.poll && (
          <PollView poll={message.poll} isOwn={isOwn} />
        )}

        {kind === "sticker" && message.body && (
          <StickerView sticker={message.body} />
        )}

        {kind === "voice" && message.attachment_url && (
          <VoiceView message={message} isOwn={isOwn} />
        )}

        {kind === "document" && message.attachment_url && (
          <DocumentView message={message} isOwn={isOwn} />
        )}

        {(kind === "text" || kind === "image" || kind === "video" || kind === "audio") &&
          message.body && (
            <p className="text-body-md wrap-break-word">{message.body}</p>
          )}

        {message.attachment_url &&
          ["image", "video", "audio"].some((t) => kind.startsWith(t)) && (
            <div className="mt-2">
              {kind.startsWith("image") ? (
                <Image
                  src={message.attachment_url}
                  alt="Adjunto"
                  width={300}
                  height={200}
                  className="rounded-xl max-h-48 object-cover"
                  unoptimized
                />
              ) : kind.startsWith("video") ? (
                <video
                  src={message.attachment_url}
                  controls
                  className="rounded-xl max-h-48 w-full"
                />
              ) : kind.startsWith("audio") ? (
                <audio
                  src={message.attachment_url}
                  controls
                  className="w-full mt-1"
                />
              ) : null}
          </div>
          )}

        <p
          className={`text-[10px] mt-1 ${
            isOwn ? "text-on-primary-container/60" : "text-on-surface-variant/60"
          }`}
        >
          {formatMessageTime(message.created_at)}
      </p>
    </div>
      {isOwn && (
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" filled />
      </div>
      )}
  </div>
  );
}



