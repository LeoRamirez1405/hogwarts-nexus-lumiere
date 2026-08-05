"use client";

import React, { useState } from "react";
import { MaterialIcon } from "../../helpers";
import DisappearMenu from "./DisappearMenu";
import ScheduleMenu from "./ScheduleMenu";
import { formatScheduleTime } from "./utils/formatScheduleTime";
import { useChatInput } from "./hooks/useChatInput";
import MentionDropdown from "@/app/(main)/messages/components/MentionDropdown";
import type { AttachmentPreview } from "../../types";
import type { Message } from "@/lib/api";

interface ChatInputDesktopProps {
  input: string;
  replyingTo: Message | null;
  attachment: AttachmentPreview | null;
  uploading: boolean;
  mentionResults: { id: string; name: string }[];
  showMentionDropdown: boolean;
  disappearAt?: string;
  onDisappearChange?: (value: string | undefined) => void;
  scheduleAt?: string;
  onScheduleChange?: (value: string | undefined) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onTypingStop: () => void;
  onSend: () => void;
  onCancelReply: () => void;
  onRemoveAttachment: () => void;
  onToggleStickers: () => void;
  onTogglePoll: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onStartVideoRecording: () => void;
  onSelectMention: (name: string) => void;
  onDismissMentions: () => void;
}

export default function ChatInputDesktop({
  input,
  replyingTo,
  attachment,
  uploading,
  mentionResults,
  showMentionDropdown,
  disappearAt,
  onDisappearChange,
  scheduleAt,
  onScheduleChange,
  inputRef,
  fileInputRef,
  onInputChange,
  onTypingStop,
  onSend,
  onCancelReply,
  onRemoveAttachment,
  onToggleStickers,
  onTogglePoll,
  onFileSelect,
  onStartRecording,
  onStartVideoRecording,
  onSelectMention,
  onDismissMentions,
}: ChatInputDesktopProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const canSend = Boolean(input.trim() || attachment) && !uploading;

  const {
    handleInputChange,
    handleKeyDown,
    handleBlur,
    handleFileClick,
    handleFileChange,
  } = useChatInput({
    fileInputRef,
    onInputChange,
    onTypingStop,
    onSend,
    onFileSelect,
    showMentionDropdown,
    onDismissMentions,
  });

  const handleToolbarAction = (action: () => void) => {
    action();
    setShowToolbar(false);
  };

  return (
    <>
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

      <div className="hidden md:flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onChange={handleFileChange}
          disabled={uploading}
        />

        <div className="relative flex-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowToolbar(!showToolbar)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            aria-label="Herramientas de mensaje"
            aria-expanded={showToolbar}
          >
            <MaterialIcon name="add_circle" className="text-xl" />
          </button>

          {showToolbar && (
            <div
              className="absolute bottom-full left-0 mb-2 w-64 bg-surface-container-highest rounded-2xl shadow-xl border border-surface-variant p-3 animate-fade-in z-50"
              role="menu"
            >
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleToolbarAction(handleFileClick)}
                  disabled={uploading}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40"
                  role="menuitem"
                >
                  <MaterialIcon name="add_circle" className="text-xl text-primary" />
                  <span className="text-label-sm">Adjuntar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToolbarAction(onToggleStickers)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                  role="menuitem"
                >
                  <MaterialIcon name="mood" className="text-xl text-secondary" />
                  <span className="text-label-sm">Stickers</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToolbarAction(onTogglePoll)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                  role="menuitem"
                >
                  <MaterialIcon name="ballot" className="text-xl text-primary" />
                  <span className="text-label-sm">Encuesta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToolbarAction(onStartRecording)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                  role="menuitem"
                >
                  <MaterialIcon name="mic" className="text-xl text-primary" />
                  <span className="text-label-sm">Voz</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToolbarAction(onStartVideoRecording)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                  role="menuitem"
                >
                  <MaterialIcon name="videocam" className="text-xl text-primary" />
                  <span className="text-label-sm">Video</span>
                </button>
              </div>

              <div className="border-t border-surface-variant pt-3">
                <p className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Mensajes que desaparecen</p>
                <DisappearMenu
                  selectedValue={disappearAt}
                  onChange={onDisappearChange ?? (() => {})}
                  className="mb-3"
                />

                <p className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Programar mensaje</p>
                {!scheduleAt && (
                  <ScheduleMenu
                    selectedValue={scheduleAt}
                    onChange={onScheduleChange ?? (() => {})}
                    onCustomClick={() => handleToolbarAction(() => {})}
                  />
                )}

                {scheduleAt && (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl text-label-sm font-medium animate-pulse-subtle">
                    <MaterialIcon name="schedule" className="text-sm" />
                    <span className="flex-1">Programado: {formatScheduleTime(scheduleAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduleChange?.(undefined);
                        setShowToolbar(false);
                      }}
                      className="p-1 rounded hover:bg-primary/20"
                      aria-label="Cancelar programación"
                    >
                      <MaterialIcon name="close" className="text-sm" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative flex-1 min-w-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
              className="w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50 resize-none min-h-[2.5rem] max-h-[8rem]"
              disabled={uploading}
              rows={1}
            />
            {mentionResults.length > 0 && <MentionDropdown results={mentionResults} onSelect={onSelectMention} anchorRef={inputRef} />}
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
      </div>
    </>
  );
}