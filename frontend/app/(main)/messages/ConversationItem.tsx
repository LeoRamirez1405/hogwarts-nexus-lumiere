"use client";

import { Conversation } from "@/lib/api";
import { Avatar, Badge } from "@/components/ui";
import { MaterialIcon, formatTimestamp, getInitials, computeOnlineStatus } from "./helpers";

const KIND_LABELS: Record<string, string> = {
  image: "Foto",
  video: "Video",
  audio: "Audio",
  voice: "Nota de voz",
  document: "Documento",
  sticker: "Sticker",
  poll: "Encuesta",
  post: "Publicación",
};

function lastMessagePreview(
  msg: { kind?: string; body?: string; sender_id?: string } | undefined,
  currentUserId: string,
  isRoom: boolean,
) {
  if (!msg) return "Sin mensajes";
  const body = msg.body?.trim();
  const label = msg.kind && msg.kind !== "text" ? KIND_LABELS[msg.kind] : undefined;
  const content = label ? (body ? `${label} · ${body}` : label) : (body || "");

  // Prefix sender info when available
  if (msg.sender_id) {
    const isMe = msg.sender_id === currentUserId;
    if (isRoom) {
      // Groups: show "Tú: ..." or the sender's name + ": ..."
      return isMe ? `Tú: ${content}` : `${content}`;
    } else {
      // DMs: show "Tú: ..." when the last message is mine
      return isMe ? `Tú: ${content}` : content || "Sin mensajes";
    }
  }
  return content || "Sin mensajes";
}

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
  onlineUsers,
  currentUserId,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onlineUsers?: Map<string, boolean>;
  currentUserId?: string;
}) {
  const isRoom = conversation.type === "room";
  const isOnlineNow =
    !isRoom && onlineUsers?.get(conversation.id) === true;
  const status = isOnlineNow
    ? "online"
    : computeOnlineStatus(conversation.last_active_at).status;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 w-full text-left transition-colors cursor-pointer ${
        isActive
          ? "bg-secondary-container/40"
          : "hover:bg-surface-container-high"
      }`}
    >
      <Avatar
        src={conversation.avatar_url}
        alt={conversation.name}
        size="sm"
        initials={getInitials(conversation.name)}
        status={isRoom ? undefined : status}
      />
<div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-body-md truncate ${
              conversation.unread_count > 0
                ? "font-bold text-on-surface"
                : "text-on-surface"
            }`}
          >
            {conversation.is_pinned && (
              <MaterialIcon name="push_pin" className="text-xs ml-1 text-primary" filled />
            )}
            {conversation.name}
            {isRoom && (
              <MaterialIcon
                name="groups"
                className="text-xs ml-1 text-on-surface-variant inline-block translate-y-1.5"
                filled
              />
            )}
            {conversation.is_muted && (
              <MaterialIcon
                name="notifications_off"
                className="text-xs ml-1 text-on-surface-variant"
                filled
              />
            )}
          </span>
          <span className="text-label-sm text-on-surface-variant ml-2 shrink-0">
            {conversation.last_message
              ? formatTimestamp(conversation.last_message.created_at)
              : ""}
         </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p
            className={`text-label-sm truncate ${
              conversation.unread_count > 0
                ? "text-on-surface font-medium"
                : "text-on-surface-variant"
            }`}
          >
            {conversation.last_message
              ? lastMessagePreview(conversation.last_message, currentUserId || "", isRoom)
              : "Sin mensajes"}
         </p>
          {conversation.unread_count > 0 && (
            <Badge variant="count">
              {conversation.unread_count > 99 ? "+99" : conversation.unread_count}
            </Badge>
          )}
       </div>
      </div>
    </button>
  );
}
