import type { Dispatch, SetStateAction } from "react";
import type { Message } from "@/lib/api/messagesTypes";
import type { Conversation } from "../types";

export const DELETE_ANIMATION_MS = 280;

/**
 * Marks a message as `deleting` so its bubble plays the Telegram-style exit
 * animation, then removes it from the list once the animation is over.
 * Returns a cancel function that restores the message (used when the API
 * delete fails and we want to roll the optimistic state back).
 */
export function markMessageDeleting(
  setMessages: Dispatch<SetStateAction<Message[]>>,
  messageId: string
): () => void {
  setMessages((prev) =>
    prev.map((m) => (m.id === messageId ? { ...m, deleting: true } : m))
  );
  const timer = window.setTimeout(() => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, DELETE_ANIMATION_MS);
  return () => {
    window.clearTimeout(timer);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, deleting: false } : m))
    );
  };
}

/**
 * Re-point a conversation's `last_message` to the newest surviving message when
 * the deleted/expired one was the preview. Falls back to "Sin mensajes".
 */
export function healConversationPreview(
  setConversations: Dispatch<SetStateAction<Conversation[]>>,
  conversationId: string,
  removedMessageId: string,
  messagesRef: { current: Message[] }
) {
  setConversations((prev) =>
    prev.map((c) => {
      if (c.id !== conversationId || c.last_message?.id !== removedMessageId) return c;
      const remaining = messagesRef.current.filter(
        (m) => m.id !== removedMessageId && !m.deleting
      );
      const newest = remaining[remaining.length - 1];
      return { ...c, last_message: newest };
    })
  );
}
