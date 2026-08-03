"use client";

import React, { useRef, useEffect, useState } from "react";
import PollCreator from "../PollCreator";
import StickerPicker from "./StickerPicker";
import MentionDropdown from "./MentionDropdown";
import ChatVoiceRecorder from "./ChatVoiceRecorder";
import ChatVideoRecorder from "./ChatVideoRecorder";
import DateTimePickerModal from "./DateTimePickerModal";
import { MaterialIcon } from "../helpers";
import BottomSheet from "@/components/ui/BottomSheet";
import type { Message, UserSearchResult } from "@/lib/api";
import type { AttachmentPreview } from "../types";
import type { VoiceRecorderState } from "../hooks/useVoiceRecorder";
import type { VideoRecorderState } from "../hooks/useVideoRecorder";

interface ToolbarButtonProps {
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}

function ToolbarButton({ onClick, icon, label, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 p-2 rounded-2xl text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40 min-w-[56px]"
      aria-label={label}
    >
      <MaterialIcon name={icon} className="text-2xl" />
      <span className="text-label-xs leading-none">{label}</span>
    </button>
  );
}

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
  video: VideoRecorderState;
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
  onStartVideoRecording: () => void;
  onStopVideoRecording: () => void;
  onCancelVideoRecording: () => void;
  onSendVideo: () => void;
  onSelectMention: (name: string) => void;
  onDismissMentions: () => void;
  disappearAt?: string;
  onDisappearChange?: (value: string | undefined) => void;
  scheduleAt?: string;
  onScheduleChange?: (value: string | undefined) => void;
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
  video,
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
  onStartVideoRecording,
  onStopVideoRecording,
  onCancelVideoRecording,
  onSendVideo,
  onSelectMention,
  onDismissMentions,
  disappearAt,
  onDisappearChange,
  scheduleAt,
  onScheduleChange,
}: ChatInputProps) {
  const canSend = Boolean(input.trim() || attachment) && !uploading;

  const [showMobileToolbar, setShowMobileToolbar] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const disappearMenuRef = useRef<HTMLDivElement>(null);
  const scheduleMenuDesktopRef = useRef<HTMLDivElement>(null);
  const scheduleMenuMobileRef = useRef<HTMLDivElement>(null);

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

  const formatScheduleTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diff = date.getTime() - now.getTime();
      
      if (diff < 0) return "Pasado";
      if (diff < 60000) return "En menos de 1 min";
      if (diff < 3600000) return `En ${Math.ceil(diff / 60000)} min`;
      if (diff < 86400000) return `En ${Math.ceil(diff / 3600000)} h`;
      return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Programado";
    }
  };
  const now = new Date();
  const scheduleOptions = [
    { label: "Desactivado", value: undefined },
    { label: "En 15 minutos", value: (now.getTime() + 15 * 60 * 1000).toString() },
    { label: "En 30 minutos", value: (now.getTime() + 30 * 60 * 1000).toString() },
    { label: "En 1 hora", value: (now.getTime() + 60 * 60 * 1000).toString() },
    { label: "En 3 horas", value: (now.getTime() + 3 * 60 * 60 * 1000).toString() },
    { label: "Mañana 9:00", value: (() => {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime().toString();
    })() },
    { label: "Fecha personalizada…", value: "custom" },
  ] as const;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (disappearMenuRef.current && !disappearMenuRef.current.contains(e.target as Node)) {
        disappearMenuRef.current.classList.add("hidden");
      }
      if (scheduleMenuDesktopRef.current && !scheduleMenuDesktopRef.current.contains(e.target as Node)) {
        scheduleMenuDesktopRef.current.classList.add("hidden");
      }
      if (scheduleMenuMobileRef.current && !scheduleMenuMobileRef.current.contains(e.target as Node)) {
        scheduleMenuMobileRef.current.classList.add("hidden");
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
            <p className="text-label-sm font-medium text-primary">Respondiendo a {replyingTo.sender?.name || "alguien"}</p>
            <p className="text-label-sm text-on-surface-variant truncate">{replyingTo.body || (replyingTo.kind === "sticker" ? "Sticker" : replyingTo.kind === "poll" ? "Encuesta" : "...")}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            aria-label="Cancelar respuesta"
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
          <span className="text-label-sm text-on-surface truncate flex-1">{attachment.name}</span>
          <button
            onClick={onRemoveAttachment}
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            aria-label="Quitar adjunto"
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
      ) : video.recording || video.previewUrl || video.error ? (
        <ChatVideoRecorder
          video={video}
          uploading={uploading}
          onSendVideo={onSendVideo}
          onStopRecording={onStopVideoRecording}
          onCancelRecording={onCancelVideoRecording}
          onRetryRecording={video.startRecording}
        />
      ) : (
        <>
          {/* Desktop: toolbar inline */}
          <div className="hidden md:flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onChange={onFileSelect}
              disabled={uploading}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
              aria-label="Adjuntar archivo"
            >
              <MaterialIcon name="add_circle" className="text-xl" />
            </button>

            <button
              type="button"
              onClick={onToggleStickers}
              className="p-1 rounded-full text-on-surface-variant hover:text-secondary transition-colors"
              title="Stickers"
              aria-label="Stickers"
            >
              <MaterialIcon name="mood" className="text-xl" />
            </button>

            <button
              type="button"
              onClick={onTogglePoll}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              title="Crear encuesta"
              aria-label="Crear encuesta"
            >
              <MaterialIcon name="ballot" className="text-xl" />
            </button>

            <button
              type="button"
              onClick={onStartRecording}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              title="Grabar voz"
              aria-label="Grabar voz"
            >
              <MaterialIcon name="mic" className="text-xl" />
            </button>

            <button
              type="button"
              onClick={onStartVideoRecording}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              title="Grabar video"
              aria-label="Grabar video"
            >
              <MaterialIcon name="videocam" className="text-xl" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const menu = disappearMenuRef.current;
                  if (menu) menu.classList.toggle("hidden");
                }}
                className={`p-1 rounded-full transition-colors ${
                  disappearAt ? "text-primary" : "text-on-surface-variant"
                } hover:bg-surface-container-high`}
                title="Mensajes que desaparecen"
                aria-label="Mensajes que desaparecen"
              >
                <MaterialIcon name="timer" className="text-xl" />
              </button>
              <div
                ref={disappearMenuRef}
                className="absolute bottom-full right-0 mb-2 w-40 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg hidden z-[100] py-1"
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

            {/* Scheduled message indicator */}
            {scheduleAt && (
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-label-sm font-medium animate-pulse-subtle">
                <MaterialIcon name="schedule" className="text-sm" />
                <span>Programado: {formatScheduleTime(scheduleAt)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScheduleChange?.(undefined);
                  }}
                  className="p-0.5 rounded hover:bg-primary/20"
                  aria-label="Cancelar programación"
                >
                  <MaterialIcon name="close" className="text-sm" />
                </button>
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const menu = scheduleMenuDesktopRef.current;
                  if (menu) menu.classList.toggle("hidden");
                }}
                className={`p-1 rounded-full transition-colors ${
                  scheduleAt ? "text-primary" : "text-on-surface-variant"
                } hover:bg-surface-container-high`}
                title="Programar mensaje"
                aria-label="Programar mensaje"
              >
                <MaterialIcon name="schedule" className="text-xl" />
              </button>
              <div
                ref={scheduleMenuDesktopRef}
                className="absolute bottom-full right-0 mb-2 w-44 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg hidden z-[100] py-1"
              >
{scheduleOptions.map((opt) => (
                    <button
                      key={opt.value?.toString() || "off"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (opt.value === "custom") {
                          setShowScheduleModal(true);
                        } else {
                          onScheduleChange?.(opt.value);
                        }
                        scheduleMenuDesktopRef.current?.classList.add("hidden");
                      }}
                    className={`w-full px-3 py-2 text-left text-label-md ${
                      scheduleAt === (opt.value?.toString() || undefined)
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
                <MentionDropdown
                  results={mentionResults}
                  onSelect={onSelectMention}
                  anchorRef={inputRef}
                />
              )}
            </div>

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Enviar mensaje"
            >
              <MaterialIcon name="send" className="text-lg" />
            </button>
          </div>

          {/* Mobile: input + botón de herramientas abre BottomSheet */}
          <div className="md:hidden flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onChange={onFileSelect}
              disabled={uploading}
            />

            <button
              type="button"
              onClick={() => setShowMobileToolbar(true)}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors"
              aria-label="Herramientas de mensaje"
            >
              <MaterialIcon name="add_circle" className="text-xl" />
            </button>

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
                <MentionDropdown
                  results={mentionResults}
                  onSelect={onSelectMention}
                  anchorRef={inputRef}
                />
              )}
            </div>

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Enviar mensaje"
            >
              <MaterialIcon name="send" className="text-lg" />
            </button>

            <BottomSheet
              open={showMobileToolbar}
              onClose={() => setShowMobileToolbar(false)}
              title="Herramientas"
              ariaLabel="Opciones del mensaje"
            >
              <div className="grid grid-cols-4 gap-3">
                <ToolbarButton
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowMobileToolbar(false);
                  }}
                  icon="add_circle"
                  label="Adjuntar"
                />
                <ToolbarButton
                  onClick={() => {
                    onToggleStickers();
                    setShowMobileToolbar(false);
                  }}
                  icon="mood"
                  label="Stickers"
                />
                <ToolbarButton
                  onClick={() => {
                    onTogglePoll();
                    setShowMobileToolbar(false);
                  }}
                  icon="ballot"
                  label="Encuesta"
                />
                <ToolbarButton
                  onClick={() => {
                    onStartRecording();
                    setShowMobileToolbar(false);
                  }}
                  icon="mic"
                  label="Voz"
                />
                <ToolbarButton
                  onClick={() => {
                    onStartVideoRecording();
                    setShowMobileToolbar(false);
                  }}
                  icon="videocam"
                  label="Video"
                />
              </div>

              <div className="mt-4">
                <p className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Mensajes que desaparecen</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const menu = disappearMenuRef.current;
                      if (menu) menu.classList.toggle("hidden");
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      disappearAt ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                    aria-label="Mensajes que desaparecen"
                  >
                    <MaterialIcon name="timer" className="text-xl" />
                    <span className="text-body-md">
                      {disappearAt
                        ? disappearOptions.find((o) => String(o.value) === String(disappearAt))?.label
                        : "Desactivado"}
                    </span>
                  </button>
                  <div
                    ref={disappearMenuRef}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg hidden z-[100] py-1"
                  >
                    {disappearOptions.map((opt) => (
                      <button
                        key={opt.value?.toString() || "off"}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDisappearChange?.(opt.value?.toString());
                          disappearMenuRef.current?.classList.add("hidden");
                        }}
                        className={`w-full px-4 py-2 text-left text-body-md ${
                          disappearAt === (opt.value?.toString() || undefined)
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider mt-4">Programar mensaje</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const menu = scheduleMenuMobileRef.current;
                      if (menu) menu.classList.toggle("hidden");
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      scheduleAt ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                    aria-label="Programar mensaje"
                  >
                    <MaterialIcon name="schedule" className="text-xl" />
                    <span className="text-body-md">
                      {scheduleAt
                        ? scheduleOptions.find((o) => String(o.value) === String(scheduleAt))?.label
                        : "Desactivado"}
                    </span>
                  </button>
                  <div
                    ref={scheduleMenuMobileRef}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg hidden z-[100] py-1"
                  >
                    {scheduleOptions.map((opt) => (
                      <button
                        key={opt.value?.toString() || "off"}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (opt.value === "custom") {
                            setShowScheduleModal(true);
                          } else {
                            onScheduleChange?.(opt.value);
                          }
                          scheduleMenuMobileRef.current?.classList.add("hidden");
                        }}
                        className={`w-full px-4 py-2 text-left text-body-md ${
                          scheduleAt === (opt.value?.toString() || undefined)
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scheduled message indicator (mobile) */}
                {scheduleAt && (
                  <div className="mt-4 flex items-center gap-2 bg-primary/10 text-primary px-4 py-3 rounded-xl text-body-md font-medium animate-pulse-subtle">
                    <MaterialIcon name="schedule" className="text-lg" />
                    <span className="flex-1">Programado: {formatScheduleTime(scheduleAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduleChange?.(undefined);
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                      aria-label="Cancelar programación"
                    >
                      <MaterialIcon name="close" className="text-base" />
                    </button>
                  </div>
                )}

            </div>

            </BottomSheet>
          </div>
        </>
      )}

      {/* DateTime Picker Modal for Custom Schedule */}
      <DateTimePickerModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onConfirm={(isoString) => onScheduleChange?.(isoString)}
        initialDateTime={scheduleAt}
        title="Programar mensaje"
      />
    </div>
  );
}
