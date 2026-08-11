"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import ChatVoiceRecorder from "./ChatVoiceRecorder";
import ChatVideoRecorder from "./ChatVideoRecorder";
import DateTimePickerModal from "./DateTimePickerModal";
import StickerPicker from "./StickerPicker";
import PollCreator from "../PollCreator";
import { MaterialIcon } from "../helpers";
import { api } from "@/lib/api";
import { toastSuccess } from "@/lib/toastStore";
import { formatScheduleTime } from "./ChatInput/utils/formatScheduleTime";
import type { Message } from "@/lib/api";
import type { MentionSuggestion } from "@/lib/mentions";
import type { AttachmentPreview } from "../types";
import type { VoiceRecorderState } from "../hooks/useVoiceRecorder";
import type { VideoRecorderState } from "../hooks/useVideoRecorder";
import { ChatInputDesktop, ChatInputMobile } from "./ChatInput/index";

interface ChatInputProps {
  input: string;
  replyingTo: Message | null;
  editingMessage: Message | null;
  onCancelEdit: () => void;
  attachment: AttachmentPreview | null;
  uploading: boolean;
  showStickers: boolean;
  stickerTab: string;
  showPoll: boolean;
  mentionResults: MentionSuggestion[];
  mentionOpen: boolean;
  mentionActiveIndex: number;
  onMentionHover: (index: number) => void;
  onMentionMove: (delta: number) => void;
  onMentionConfirm: () => void;
  voice: VoiceRecorderState;
  video: VideoRecorderState;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
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
  onSelectMention: (suggestion: MentionSuggestion) => void;
  onDismissMentions: () => void;
  disappearAt?: string;
  onDisappearChange?: (value: string | undefined) => void;
  scheduleAt?: string;
  onScheduleChange?: (value: string | undefined) => void;
  onViewScheduled?: () => void;
  convId?: string;
  convType?: "room" | "dm";
}

export default function ChatInput({
  input,
  replyingTo,
  editingMessage,
  onCancelEdit,
  attachment,
  uploading,
  showStickers,
  stickerTab,
  showPoll,
  mentionResults,
  mentionOpen,
  mentionActiveIndex,
  onMentionHover,
  onMentionMove,
  onMentionConfirm,
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
  onViewScheduled,
  convId,
  convType,
}: ChatInputProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [hasScheduledInChat, setHasScheduledInChat] = useState(false);

  const refreshScheduledInChat = useCallback(async () => {
    if (!convId || !convType) {
      setHasScheduledInChat(false);
      return;
    }
    try {
      const msgs = await api.getScheduledMessages();
      const mine = msgs.some((m) =>
        convType === "room" ? m.room_id === convId : m.receiver_id === convId
      );
      setHasScheduledInChat(mine);
    } catch {
      setHasScheduledInChat(false);
    }
  }, [convId, convType]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!convId || !convType) {
        if (active) setHasScheduledInChat(false);
        return;
      }
      try {
        const msgs = await api.getScheduledMessages();
        if (active) {
          setHasScheduledInChat(
            msgs.some((m) =>
              convType === "room" ? m.room_id === convId : m.receiver_id === convId
            )
          );
        }
      } catch {
        if (active) setHasScheduledInChat(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [convId, convType]);

  // Tras programar (o cancelar la programación) el chip se limpia: refresca
  // el estado del botón "Ver mis mensajes programados".
  const prevScheduleAtRef = useRef(scheduleAt);
  useEffect(() => {
    if (prevScheduleAtRef.current && !scheduleAt) {
      refreshScheduledInChat();
    }
    prevScheduleAtRef.current = scheduleAt;
  }, [scheduleAt, refreshScheduledInChat]);

  const commonProps = {
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
    onCustomScheduleClick: () => setShowScheduleModal(true),
    onViewScheduled,
    showScheduledEntry: hasScheduledInChat,
    onRequestScheduledRefresh: refreshScheduledInChat,
    inputRef,
    fileInputRef,
    onInputChange,
    onTypingStop,
    onSend,
    onToggleStickers,
    onTogglePoll,
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
  };

  return (
    <div className="px-4 py-3 border-t border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
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
        />
      ) : (
        <>
          {showStickers && (
            <StickerPicker tab={stickerTab} onTabChange={onStickerTabChange} onSendSticker={onSendSticker} />
          )}
          {showPoll && (
            <PollCreator onCreate={onPollCreate} onCancel={onCancelPoll} />
          )}

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

          {editingMessage && (
            <div className="mb-2 flex items-center gap-2 bg-secondary-container/50 border border-secondary/30 rounded-xl px-3 py-2">
              <MaterialIcon name="edit" className="text-secondary text-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-label-sm font-medium text-secondary">Editando mensaje</p>
                <p className="text-label-sm text-on-surface-variant truncate">&ldquo;{(editingMessage.body || "").slice(0, 40)}{(editingMessage.body || "").length > 40 ? "…" : ""}&rdquo;</p>
              </div>
              <button
                onClick={onCancelEdit}
                className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
                aria-label="Cancelar edición"
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

          <Suspense fallback={null}>
            <ChatInputDesktop {...commonProps} />
            <ChatInputMobile {...commonProps} />
          </Suspense>
        </>
      )}

      <DateTimePickerModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onConfirm={(isoString) => {
          onScheduleChange?.(isoString);
          setShowScheduleModal(false);
          toastSuccess("Mensaje programado", `Se enviará ${formatScheduleTime(isoString)}`);
        }}
        initialDateTime={scheduleAt}
        title="Programar mensaje"
      />
    </div>
  );
}