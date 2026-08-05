"use client";

import React, { useState } from "react";
import { MaterialIcon } from "../../helpers";
import ToolbarButton from "./ToolbarButton";
import DisappearMenu from "./DisappearMenu";
import ScheduleMenu from "./ScheduleMenu";
import BottomSheet from "@/components/ui/BottomSheet";
import { formatScheduleTime } from "./utils/formatScheduleTime";
import { useChatInput } from "./hooks/useChatInput";
import MentionDropdown from "@/app/(main)/messages/components/MentionDropdown";
import type { AttachmentPreview } from "../../types";
import type { Message } from "@/lib/api";

interface ChatInputMobileProps {
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
  onCustomScheduleClick: () => void;
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

export default function ChatInputMobile({
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
  onCustomScheduleClick,
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
}: ChatInputMobileProps) {
  const [showMobileToolbar, setShowMobileToolbar] = useState(false);
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

  return (
    <>
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
          <MaterialIcon name="reply" className="text-primary text-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-label-sm font-medium text-primary">Respondiendo a {replyingTo.sender?.name || "alguien"}</p>
            <p className="text-label-sm text-on-surface-variant truncate">{replyingTo.body || (replyingTo.kind === "sticker" ? "Sticker" : replyingTo.kind === "poll" ? "Encuesta" : "...")}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant" aria-label="Cancelar respuesta">
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      )}

      {attachment && (
        <div className="mb-2 flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2">
          <MaterialIcon
            name={attachment.type.startsWith("image") ? "image" : attachment.type.startsWith("video") ? "videocam" : attachment.type.startsWith("audio") ? "music_note" : "attach_file"}
            className="text-lg text-primary"
          />
          <span className="text-label-sm text-on-surface truncate flex-1">{attachment.name}</span>
          <button onClick={onRemoveAttachment} className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant" aria-label="Quitar adjunto">
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      )}

      <div className="md:hidden flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" className="absolute opacity-0 w-0 h-0 pointer-events-none" onChange={handleFileChange} disabled={uploading} />

        <button type="button" onClick={() => setShowMobileToolbar(true)} className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors" aria-label="Herramientas de mensaje">
          <MaterialIcon name="add_circle" className="text-xl" />
        </button>

        <div className="relative flex-1">
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
            <ScheduleMenu selectedValue={scheduleAt} onChange={onScheduleChange ?? (() => {})} onCustomClick={onCustomScheduleClick} mobile />

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