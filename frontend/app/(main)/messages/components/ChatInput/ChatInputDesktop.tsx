"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "../../helpers";
import DisappearMenu from "./DisappearMenu";
import ScheduleMenu from "./ScheduleMenu";
import { formatScheduleTime } from "./utils/formatScheduleTime";
import { useChatInput } from "./hooks/useChatInput";
import { useAutoResizeTextarea } from "./hooks/useAutoResizeTextarea";
import MentionDropdown from "@/app/(main)/messages/components/MentionDropdown";
import type { AttachmentPreview } from "../../types";
import type { Message } from "@/lib/api";
import type { MentionSuggestion } from "@/lib/mentions";

interface ChatInputDesktopProps {
  input: string;
  replyingTo: Message | null;
  editingMessage: Message | null;
  onCancelEdit: () => void;
  attachment: AttachmentPreview | null;
  uploading: boolean;
  mentionResults: MentionSuggestion[];
  mentionOpen: boolean;
  mentionActiveIndex: number;
  onMentionHover: (index: number) => void;
  onMentionMove: (delta: number) => void;
  onMentionConfirm: () => void;
  disappearAt?: string;
  onDisappearChange?: (value: string | undefined) => void;
  scheduleAt?: string;
  onScheduleChange?: (value: string | undefined) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onTypingStop: () => void;
  onSend: () => void;
  onToggleStickers: () => void;
  onTogglePoll: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onStartVideoRecording: () => void;
  onSelectMention: (suggestion: MentionSuggestion) => void;
  onDismissMentions: () => void;
}

export default function ChatInputDesktop({
  input,
  replyingTo,
  editingMessage,
  onCancelEdit,
  attachment,
  uploading,
  mentionResults,
  mentionOpen,
  mentionActiveIndex,
  onMentionHover,
  onMentionMove,
  onMentionConfirm,
  disappearAt,
  onDisappearChange,
  scheduleAt,
  onScheduleChange,
  inputRef,
  fileInputRef,
  onInputChange,
  onTypingStop,
  onSend,
  onToggleStickers,
  onTogglePoll,
  onFileSelect,
  onStartRecording,
  onStartVideoRecording,
  onSelectMention,
  onDismissMentions,
}: ChatInputDesktopProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const canSend = Boolean(input.trim() || attachment) && !uploading;

  // Cierra el menú de herramientas al hacer clic fuera de él (o con Escape),
  // en vez de obligar a pulsar de nuevo el botón (+) para contraerlo.
  useEffect(() => {
    if (!showToolbar) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowToolbar(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowToolbar(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showToolbar]);

  // Auto-crecimiento del campo. Fusionamos el ref local (para medir/redimensionar)
  // con el inputRef compartido (foco / posición del caret).
  const { ref: autoResizeRef } = useAutoResizeTextarea(input);
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      autoResizeRef.current = node;
      inputRef.current = node;
    },
    [autoResizeRef, inputRef]
  );

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
    mentionOpen,
    onMentionMove,
    onMentionConfirm,
    onDismissMentions,
    onCancelEdit: editingMessage ? onCancelEdit : undefined,
  });

  const handleToolbarAction = (action: () => void) => {
    action();
    setShowToolbar(false);
  };

  return (
    <>
      <div className="hidden md:flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onChange={handleFileChange}
          disabled={uploading}
        />

        <div ref={toolbarRef} className="relative flex-1 flex items-center gap-2">
          {mentionOpen && (
            <MentionDropdown
              results={mentionResults}
              activeIndex={mentionActiveIndex}
              onSelect={onSelectMention}
              onHover={onMentionHover}
            />
          )}
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
              ref={setTextareaRef}
              value={input}
              onChange={handleInputChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? "Edita tu mensaje..." : replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
              className="block w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50 resize-none min-h-[2.5rem] max-h-[8rem] leading-6 py-2"
              disabled={uploading}
              rows={1}
            />
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