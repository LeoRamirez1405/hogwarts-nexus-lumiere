"use client";

import React, { useState, Suspense } from "react";
import ChatVoiceRecorder from "./ChatVoiceRecorder";
import ChatVideoRecorder from "./ChatVideoRecorder";
import DateTimePickerModal from "./DateTimePickerModal";
import StickerPicker from "./StickerPicker";
import PollCreator from "../PollCreator";
import type { Message, UserSearchResult } from "@/lib/api";
import type { AttachmentPreview } from "../types";
import type { VoiceRecorderState } from "../hooks/useVoiceRecorder";
import type { VideoRecorderState } from "../hooks/useVideoRecorder";
import { ChatInputDesktop, ChatInputMobile } from "./ChatInput/index";

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
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const commonProps = {
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
    onCustomScheduleClick: () => setShowScheduleModal(true),
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
          <Suspense fallback={null}>
            <ChatInputDesktop {...commonProps} />
            <ChatInputMobile {...commonProps} />
          </Suspense>
        </>
      )}

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