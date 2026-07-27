"use client";

import { Conversation } from "@/lib/api";
import { Avatar, Badge } from "@/components/ui";
import { MaterialIcon, formatTimestamp, getInitials } from "./helpers";

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const isRoom = conversation.type === "room";
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
            {conversation.name}
            {isRoom && (
              <MaterialIcon
                name="groups"
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
            {conversation.last_message?.body ?? "Sin mensajes"}
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
