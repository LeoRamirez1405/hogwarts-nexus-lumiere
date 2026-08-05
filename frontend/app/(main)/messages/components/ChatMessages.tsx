"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { MaterialIcon } from "../helpers";
import { MessageBubble } from "../MessageRenderers";
import type { Message, ChatRoomMemberResponse } from "@/lib/api";

interface ChatMessagesProps {
  messages: Message[];
  user: { id?: string } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  dividerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  firstUnreadId?: string | null;
  unreadCount?: number;
  loadingOlder?: boolean;
  hasMore?: boolean;
  isRoom: boolean;
  roomMembers?: ChatRoomMemberResponse[];
  typingUsers?: Map<string, string>;
  replyingToId?: string | null;
  showScrollBtn: boolean;
  newCount: number;
  onScrollToBottom: () => void;
  onReply: (msg: Message) => void;
  onRefresh?: () => void;
  onScrollToMessage: (id: string) => void;
  onTogglePin?: (msg: Message) => void;
  onToggleStar?: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onPollVote?: (messageId: string, updatedPoll: NonNullable<Message["poll"]>) => void;
}

export default function ChatMessages({
  messages,
  user,
  containerRef,
  dividerRef,
  onScroll,
  firstUnreadId,
  unreadCount,
  loadingOlder,
  hasMore,
  isRoom,
  roomMembers,
  typingUsers,
  replyingToId,
  showScrollBtn,
  newCount,
  onScrollToBottom,
  onReply,
  onRefresh,
  onScrollToMessage,
  onTogglePin,
  onToggleStar,
  onEdit,
  onDelete,
  onForward,
  onPollVote,
}: ChatMessagesProps) {
  // Force re-evaluation every 5s so messages with disappear_at that just
  // passed get filtered out without waiting for a backend sweep.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (!m.disappear_at) return true;
        return new Date(m.disappear_at).getTime() > now;
      }),
    [messages, now]
  );

  const onScrollRef = useRef(onScroll);
  useEffect(() => {
    onScrollRef.current = onScroll;
  });

  const handleScrollerRef = useCallback(
    (ref: HTMLElement | Window | null) => {
      containerRef.current = ref as HTMLDivElement | null;
    },
    [containerRef]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.add("no-scrollbar");
    const listener = () => onScrollRef.current();
    el.addEventListener("scroll", listener, { passive: true });
    return () => el.removeEventListener("scroll", listener);
  }, [containerRef]);

  return (
    <>
      <div className="relative h-full px-4 py-4">
        <Virtuoso
          data={visibleMessages}
          scrollerRef={handleScrollerRef}
          components={{
            Header: () => (
              <>
                {loadingOlder && (
                  <div className="flex justify-center py-2">
                    <MaterialIcon
                      name="progress_activity"
                      className="text-xl text-outline-variant animate-spin"
                    />
                  </div>
                )}
                {!hasMore && (
                  <p className="text-center text-label-sm text-on-surface-variant/50 py-2">
                    Inicio de la conversacion
                  </p>
                )}
              </>
            ),
            Footer: () => (
              <>
                {typingUsers && typingUsers.size > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 text-label-sm text-on-surface-variant animate-pulse">
                    <span className="flex items-center gap-1">
                      <span className="flex gap-[2px]">
                        <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "está escribiendo..." : "están escribiendo..."}
                    </span>
                  </div>
                )}
                {!hasMore && (
                  <p className="text-center text-label-sm text-on-surface-variant/50 py-2">
                    Inicio de la conversacion
                  </p>
                )}
              </>
            ),
            EmptyPlaceholder: () => (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MaterialIcon name="forum" className="text-5xl text-outline-variant mb-3" />
                <p className="text-on-surface-variant text-body-md">
                  No hay mensajes aún
                </p>
                <p className="text-on-surface-variant/60 text-label-sm mt-1">
                  Envia el primer mensaje
                </p>
              </div>
            ),
          }}
          itemContent={(index, msg: Message) => (
            <div key={msg.id}>
              {firstUnreadId && msg.id === firstUnreadId && (
                <div ref={dividerRef} className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-primary/30" />
                  <span className="text-label-sm font-medium text-primary bg-primary/10 px-3 py-0.5 rounded-full whitespace-nowrap">
                    {unreadCount && unreadCount > 0
                      ? `${unreadCount} mensaje${unreadCount !== 1 ? "s" : ""} no leido${unreadCount !== 1 ? "s" : ""}`
                      : "No leidos"}
                  </span>
                  <div className="flex-1 h-px bg-primary/30" />
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === user?.id}
                isReplyTarget={replyingToId === msg.id}
                onReply={onReply}
                onReactionChange={onRefresh}
                onScrollToMessage={onScrollToMessage}
                onTogglePin={onTogglePin}
                onToggleStar={onToggleStar}
                onForward={onForward}
                onEdit={onEdit}
                onDelete={onDelete}
                onPollVote={onPollVote}
                members={isRoom ? roomMembers : undefined}
              />
            </div>
          )}
          style={{ height: "100%" }}
        />
      </div>

      {showScrollBtn && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-4 right-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-highest shadow-lg border border-outline-variant/20 text-on-surface hover:bg-surface-container-high transition-colors"
          title="Ir al ultimo mensaje"
        >
          <MaterialIcon name="keyboard_arrow_down" className="text-2xl" />
          {newCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-on-primary text-[10px] font-semibold">
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
