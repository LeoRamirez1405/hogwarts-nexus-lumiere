"use client";

import React, { useCallback, useState } from "react";
import { MaterialIcon } from "../../helpers";
import ToolbarButton from "./ToolbarButton";
import DisappearMenu from "./DisappearMenu";
import ScheduleMenu from "./ScheduleMenu";
import BottomSheet from "@/components/ui/BottomSheet";
import { formatScheduleTime } from "./utils/formatScheduleTime";
import { useChatInput } from "./hooks/useChatInput";
import { useAutoResizeTextarea } from "./hooks/useAutoResizeTextarea";
import MentionDropdown from "@/app/(main)/messages/components/MentionDropdown";
import type { AttachmentPreview } from "../../types";
import type { Message, UserSearchResult } from "@/lib/api";

interface ChatInputMobileProps {
  input: string;
  replyingTo: Message | null;
  editingMessage: Message | null;
  onCancelEdit: () => void;
  attachment: AttachmentPreview | null;
  uploading: boolean;
  mentionResults: UserSearchResult[];
  mentionOpen: boolean;
  mentionActiveIndex: number;
  onMentionHover: (index: number) => void;
  onMentionMove: (delta: number) => void;
  onMentionConfirm: () => void;
  disappearAt?: string;
  onDisappearChange?: (value: string | undefined) => void;
  scheduleAt?: string;
  onScheduleChange?: (value: string | undefined) => void;
  onCustomScheduleClick: () => void;
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
  onSelectMention: (name: string) => void;
  onDismissMentions: () => void;
}

export default function ChatInputMobile({
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
  onCustomScheduleClick,
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
}: ChatInputMobileProps) {
  const [showMobileToolbar, setShowMobileToolbar] = useState(false);
  const canSend = Boolean(input.trim() || attachment) && !uploading;

  // Auto-crecimiento del campo (ver ChatInputDesktop). Fusiona el ref local con
  // el inputRef compartido.
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

  return (
    <>
      <div className="md:hidden relative flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
        {mentionOpen && (
          <MentionDropdown
            results={mentionResults}
            activeIndex={mentionActiveIndex}
            onSelect={onSelectMention}
            onHover={onMentionHover}
          />
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" className="absolute opacity-0 w-0 h-0 pointer-events-none" onChange={handleFileChange} disabled={uploading} />

        <button type="button" onClick={() => setShowMobileToolbar(true)} className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors" aria-label="Herramientas de mensaje">
          <MaterialIcon name="add_circle" className="text-xl" />
        </button>

        <div className="relative flex-1">
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

        <button type="button" onClick={onSend} disabled={!canSend} className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none" aria-label="Enviar mensaje">
          <MaterialIcon name="send" className="text-lg" />
        </button>

        <BottomSheet open={showMobileToolbar} onClose={() => setShowMobileToolbar(false)} title="Herramientas" ariaLabel="Opciones del mensaje">
          <div className="grid grid-cols-4 gap-3">
            <ToolbarButton onClick={() => { handleFileClick(); setShowMobileToolbar(false); }} icon="add_circle" label="Adjuntar" />
            <ToolbarButton onClick={() => { onToggleStickers(); setShowMobileToolbar(false); }} icon="mood" label="Stickers" />
            <ToolbarButton onClick={() => { onTogglePoll(); setShowMobileToolbar(false); }} icon="ballot" label="Encuesta" />
            <ToolbarButton onClick={() => { onStartRecording(); setShowMobileToolbar(false); }} icon="mic" label="Voz" />
            <ToolbarButton onClick={() => { onStartVideoRecording(); setShowMobileToolbar(false); }} icon="videocam" label="Video" />
          </div>

          <div className="mt-4">
            <p className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Mensajes que desaparecen</p>
            <DisappearMenu selectedValue={disappearAt} onChange={onDisappearChange ?? (() => {})} mobile />

            <p className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider mt-4">Programar mensaje</p>
            {!scheduleAt && (
              <ScheduleMenu selectedValue={scheduleAt} onChange={onScheduleChange ?? (() => {})} onCustomClick={onCustomScheduleClick} mobile />
            )}

            {scheduleAt && (
              <div className="mt-4 flex items-center gap-2 bg-primary/10 text-primary px-4 py-3 rounded-xl text-body-md font-medium animate-pulse-subtle">
                <MaterialIcon name="schedule" className="text-lg" />
                <span className="flex-1">Programado: {formatScheduleTime(scheduleAt)}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onScheduleChange?.(undefined); }} className="p-1 rounded hover:bg-primary/20" aria-label="Cancelar programación">
                  <MaterialIcon name="close" className="text-base" />
                </button>
              </div>
            )}
          </div>
        </BottomSheet>
      </div>
    </>
  );
}