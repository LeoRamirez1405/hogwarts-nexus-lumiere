"use client";

import React, { useRef, useEffect } from "react";
import PollCreator from "../PollCreator";
import StickerPicker from "./StickerPicker";
import MentionDropdown from "./MentionDropdown";
import ChatVoiceRecorder from "./ChatVoiceRecorder";
import { MaterialIcon } from "../helpers";
import type { Message, UserSearchResult } from "@/lib/api";
import type { AttachmentPreview } from "../types";
import type { VoiceRecorderState } from "../hooks/useVoiceRecorder";

interface ChatInputProps {
  input: string;
  replyingTo: Message | null;
  attachment: AttachmentPreview | null;
  uploading: boolean;
  showStickers: boolean;
  stickerTab: string;
  showPoll: boolean;
  mentionResults: UserSearchResult[];
  showMentionDropdown: boolean;
  voice: VoiceRecorderState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onTypingStop: () => void;
  onSend: () => void;
  onCancelReply: () => void;
  onRemoveAttachment: () => void;
  onToggleStickers: () => void;
  onStickerTabChange: (tab: string) => void;
  onSendSticker: (sticker: string) => void;
  onTogglePoll: () => void;
  onPollCreate: (question: string, options: string[], multiChoice: boolean) => void;
  onCancelPoll: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSendVoice: () => void;
  onTranscribeVoice: () => void;
  onSelectMention: (name: string) => void;
  onDismissMentions: () => void;
  disappearAt?: string;
  onDisappearChange?: (value: string | undefined) => void;
}

export default function ChatInput({
  input,
  replyingTo,
  attachment,
  uploading,
  showStickers,
  stickerTab,
  showPoll,
  mentionResults,
  showMentionDropdown,
  voice,
  inputRef,
  fileInputRef,
  onInputChange,
  onTypingStop,
  onSend,
  onCancelReply,
  onRemoveAttachment,
  onToggleStickers,
  onStickerTabChange,
  onSendSticker,
  onTogglePoll,
  onPollCreate,
  onCancelPoll,
  onFileSelect,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSendVoice,
  onTranscribeVoice,
  onSelectMention,
  onDismissMentions,
  disappearAt,
  onDisappearChange,
}: ChatInputProps) {
  const canSend = Boolean(input.trim() || attachment) && !uploading;

  const disappearOptions = [
    { label: "Desactivado", value: undefined },
    { label: "5 segundos", value: 5 },
    { label: "10 segundos", value: 10 },
    { label: "30 segundos", value: 30 },
    { label: "1 minuto", value: 60 },
    { label: "5 minutos", value: 300 },
    { label: "1 hora", value: 3600 },
    { label: "24 horas", value: 86400 },
  ] as const;

  const disappearMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (disappearMenuRef.current && !disappearMenuRef.current.contains(e.target as Node)) {
        disappearMenuRef.current.classList.add("hidden");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="px-4 py-3 border-t border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
          <MaterialIcon name="reply" className="text-primary text-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-label-sm font-medium text-primary">
              Respondiendo a {replyingTo.sender?.name || "alguien"}
            </p>
            <p className="text-label-sm text-on-surface-variant truncate">
              {replyingTo.body || (replyingTo.kind === "sticker" ? "Sticker" : replyingTo.kind === "poll" ? "Encuesta" : "...")}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
          >
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      )}

      {attachment && (
        <div className="mb-2 flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2">
          <MaterialIcon
            name={
              attachment.type.startsWith("image")
                ? "image"
                : attachment.type.startsWith("video")
                ? "videocam"
                : attachment.type.startsWith("audio")
                ? "music_note"
                : "attach_file"
            }
            className="text-lg text-primary"
          />
          <span className="text-label-sm text-on-surface truncate flex-1">
            {attachment.name}
          </span>
          <button
            onClick={onRemoveAttachment}
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
          >
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      )}

      {showStickers && (
        <StickerPicker tab={stickerTab} onTabChange={onStickerTabChange} onSendSticker={onSendSticker} />
      )}

      {showPoll && (
        <PollCreator onCreate={onPollCreate} onCancel={onCancelPoll} />
      )}

      {voice.recording || voice.recordedBlob ? (
        <ChatVoiceRecorder
          voice={voice}
          uploading={uploading}
          onSendVoice={onSendVoice}
          onTranscribeVoice={onTranscribeVoice}
          onStopRecording={onStopRecording}
          onCancelRecording={onCancelRecording}
        />
      ) : (
        <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2 relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            onChange={onFileSelect}
            disabled={uploading}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
          >
            <MaterialIcon name="add_circle" className="text-xl" />
          </button>

          <button
            onClick={onToggleStickers}
            className="p-1 rounded-full text-on-surface-variant hover:text-secondary transition-colors"
            title="Stickers"
          >
            <MaterialIcon name="emoji_emotions" className="text-xl" />
          </button>

          <button
            onClick={onTogglePoll}
            className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
            title="Crear encuesta"
          >
            <MaterialIcon name="ballot" className="text-xl" />
          </button>

          <button
            onClick={onStartRecording}
            className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
            title="Grabar voz"
          >
            <MaterialIcon name="mic" className="text-xl" />
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const menu = disappearMenuRef.current;
                if (menu) menu.classList.toggle("hidden");
              }}
              className={`p-1 rounded-full transition-colors ${
                disappearAt ? "text-primary" : "text-on-surface-variant"
              } hover:bg-surface-container-high`}
              title="Mensajes que desaparecen"
            >
              <MaterialIcon name="timer" className="text-xl" />
            </button>
            <div
              ref={disappearMenuRef}
              className="absolute bottom-full right-0 mb-2 w-40 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg hidden z-20 py-1"
            >
              {disappearOptions.map((opt) => (
                <button
                  key={opt.value?.toString() || "off"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisappearChange?.(opt.value?.toString());
                    disappearMenuRef.current?.classList.add("hidden");
                  }}
                  className={`w-full px-3 py-2 text-left text-label-md ${
                    disappearAt === (opt.value?.toString() || undefined)
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onBlur={onTypingStop}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!showMentionDropdown) onSend();
                } else if (e.key === "Escape") {
                  onDismissMentions();
                }
              }}
              placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
              className="w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50"
              disabled={uploading}
            />
            {mentionResults.length > 0 && (
              <MentionDropdown results={mentionResults} onSelect={onSelectMention} />
            )}
          </div>

          <button
            onClick={onSend}
            disabled={!canSend}
            className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
          >
            <MaterialIcon name="send" className="text-lg" />
          </button>
        </div>
      )}
    </div>
  );
}