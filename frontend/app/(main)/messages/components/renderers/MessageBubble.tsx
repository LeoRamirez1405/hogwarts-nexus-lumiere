"use client";

import { useState, useEffect } from "react";
import { MaterialIcon } from "@/components/ui";
import { formatMessageTime } from "@/app/(main)/messages/helpers";
import { ReplyPreview } from "./ReplyPreview";
import { PollView } from "./PollView";
import { PostShareView } from "./PostShareView";
import { StickerView } from "./StickerView";
import { VoiceView } from "./VoiceView";
import { DocumentView } from "./DocumentView";
import { ImageView } from "./ImageView";
import { VideoView } from "./VideoView";
import { AudioView } from "./AudioView";
import { MentionText } from "./MentionText";
import { ReactionBar } from "./ReactionBar";
import { MessageActions } from "./MessageActions";
import type { MessageBubbleProps } from "./types";

const formatDisappearTime = (disappearAt: string) => {
  const diff = new Date(disappearAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const seconds = Math.ceil(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
};

export const MessageBubble = ({
  message,
  isOwn,
  onReply,
  onReactionChange,
  onScrollToMessage,
  onTogglePin,
  onToggleStar,
  onForward,
  onEdit,
  onDelete,
  members,
}: MessageBubbleProps) => {
  const [dataSaver] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nexus-data-saver") === "true";
    }
    return false;
  });
  const [loadMedia, setLoadMedia] = useState<string | null>(null);
  const [disappearTime, setDisappearTime] = useState("");
  const kind = message.kind || "text";

  useEffect(() => {
    if (!message.disappear_at) return;
    const update = () => setDisappearTime(formatDisappearTime(message.disappear_at!));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [message.disappear_at]);

  const shouldLoadMedia = (url: string) => {
    if (!dataSaver) return true;
    return loadMedia === url;
  };

  return (
    <div id={`msg-${message.id}`} className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 gap-2 group`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" />
        </div>
      )}
      <div className="max-w-[70%] flex flex-col">
        <div
          className={`px-4 py-2.5 ${
            isOwn
              ? "bg-primary text-white rounded-2xl rounded-tr-none"
              : "bg-white text-on-surface rounded-2xl rounded-tl-none border border-outline-variant/20"
          }`}
        >
          <ReplyPreview message={message} onScrollToMessage={onScrollToMessage} />

          {kind === "poll" && message.poll && <PollView poll={message.poll} isOwn={isOwn} />}
          {kind === "post" && <PostShareView message={message} isOwn={isOwn} />}
          {kind === "sticker" && message.body && <StickerView sticker={message.body} />}
          {kind === "voice" && message.attachment_url && <VoiceView message={message} isOwn={isOwn} />}
          {kind === "document" && message.attachment_url && <DocumentView message={message} isOwn={isOwn} />}

          {(kind === "text" || kind === "image" || kind === "video" || kind === "audio") && message.body && (
            <p className="text-body-md wrap-break-word">
              <MentionText text={message.body} isOwn={isOwn} members={members} />
            </p>
          )}

          {message.attachment_url && ["image", "video", "audio"].some((t) => kind.startsWith(t)) && (
            <div className="mt-2">
              {dataSaver && !shouldLoadMedia(message.attachment_url!) ? (
                kind.startsWith("image") ? (
                  <ImageView
                    url={message.attachment_url!}
                    isOwn={isOwn}
                    dataSaver={dataSaver}
                    shouldLoad={false}
                    onLoadClick={() => setLoadMedia(message.attachment_url!)}
                  />
                ) : kind.startsWith("video") ? (
                  <VideoView
                    url={message.attachment_url!}
                    isOwn={isOwn}
                    dataSaver={dataSaver}
                    shouldLoad={false}
                    onLoadClick={() => setLoadMedia(message.attachment_url!)}
                  />
                ) : (
                  <AudioView
                    url={message.attachment_url!}
                    isOwn={isOwn}
                    dataSaver={dataSaver}
                    shouldLoad={false}
                    onLoadClick={() => setLoadMedia(message.attachment_url!)}
                  />
                )
              ) : kind.startsWith("image") ? (
                <ImageView url={message.attachment_url!} isOwn={isOwn} />
              ) : kind.startsWith("video") ? (
                <VideoView url={message.attachment_url!} isOwn={isOwn} />
              ) : kind.startsWith("audio") ? (
                <AudioView url={message.attachment_url!} isOwn={isOwn} />
              ) : null}
            </div>
          )}

          <div className={`flex items-center gap-1 mt-1 ${isOwn ? "text-white/60" : "text-on-surface-variant"}`}>
            {message.pinned && <MaterialIcon name="push_pin" className="text-[11px]" filled />}
            {message.disappear_at && (
              <span className="flex items-center gap-0.5 text-[10px]" title="Este mensaje desaparecerá">
                <MaterialIcon name="timer" className="text-[10px]" />
                <span>{disappearTime || "..."}</span>
              </span>
            )}
            <p className="text-[10px]">{formatMessageTime(message.created_at)}</p>
          </div>
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <ReactionBar reactions={message.reactions} messageId={message.id} onReacted={onReactionChange} />
        )}
      </div>

      <MessageActions
        message={message}
        isOwn={isOwn}
        onReply={onReply}
        onTogglePin={onTogglePin}
        onToggleStar={onToggleStar}
        onForward={onForward}
        onEdit={onEdit}
        onDelete={onDelete}
        onReactionChange={onReactionChange}
      />

      {isOwn && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" filled />
        </div>
      )}
    </div>
  );
};