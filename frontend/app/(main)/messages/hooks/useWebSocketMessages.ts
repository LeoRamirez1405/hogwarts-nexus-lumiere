"use client";

import { useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import type { Message, Conversation, SelectedConvType } from "../types";

interface WsClient {
  isConnected: () => boolean;
  sendMessage: (conversationId: string, data: unknown) => void;
  markRead: (conversationId: string, messageId: string) => void;
}

interface UseWebSocketMessagesOptions {
  selectedId: string | null;
  selectedType: SelectedConvType | null;
  messagesRef: React.MutableRefObject<Message[]>;
  selectedIdRef: React.MutableRefObject<string | null>;
  selectedTypeRef: React.MutableRefObject<SelectedConvType | null>;
  wsClient: WsClient;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setTypingUsers: React.Dispatch<React.SetStateAction<Map<string, Map<string, string>>>>;
  setOnlineUsers: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
  api: { getMessagesSince: (id: string, limit: number) => Promise<Message[]>; getConversations: () => Promise<Conversation[]> };
}

export function useWebSocketMessages({
  selectedId,
  selectedType: _selectedType,
  messagesRef,
  selectedIdRef,
  selectedTypeRef,
  wsClient,
  setMessages,
  setConversations,
  setTypingUsers,
  setOnlineUsers,
  api,
}: UseWebSocketMessagesOptions) {
  const handleNewMessage = useCallback((_conversationId: string, message: Message) => {
    if (selectedIdRef.current === _conversationId) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        const hasSending = prev.some((m) => m.sending && m.optimistic);
        const next = hasSending
          ? prev.map((m) => (m.sending && m.optimistic ? message : m))
          : [...prev, message];
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      if (wsClient.isConnected()) {
        wsClient.markRead(_conversationId, message.id);
      }
    }
    setConversations((prev: Conversation[]) =>
      prev.map((c) =>
        c.id === _conversationId
          ? { ...c, last_message: message, unread_count: c.id !== selectedIdRef.current ? c.unread_count + 1 : c.unread_count }
          : c
      )
    );
  }, [wsClient, setMessages, setConversations]);

  const handleTyping = useCallback((conversationId: string, userId: string) => {
    setTypingUsers((prev) => {
      const next = new Map(prev);
      const ct = next.get(conversationId) || new Map();
      ct.set(userId, "");
      next.set(conversationId, ct);
      return next;
    });
  }, []);

  const handleTypingStop = useCallback((conversationId: string, userId: string) => {
    setTypingUsers((prev) => {
      const next = new Map(prev);
      const ct = next.get(conversationId);
      if (ct) {
        ct.delete(userId);
        if (ct.size === 0) next.delete(conversationId);
      }
      return next;
    });
  }, []);

  const handlePresence = useCallback((userId: string, status: "online" | "offline") => {
    setOnlineUsers((prev) => {
      const next = new Map(prev);
      next.set(userId, status === "online");
      return next;
    });
  }, []);

  const handleReadReceipt = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, read: true } : m));
  }, []);

  const handleReactionUpdate = useCallback((messageId: string, reactions: Message["reactions"]) => {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
  }, []);

  const handleWSDelete = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const handleWSEdit = useCallback((message: Message) => {
    setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, ...message } : m));
  }, []);

  const handleCatchUp = useCallback(() => {
    const id = selectedIdRef.current;
    const type = selectedTypeRef.current;
    if (id && type) {
      const oldest = messagesRef.current[0];
      if (oldest) {
        api.getMessagesSince(oldest.id, 50).then((newMessages: Message[]) => {
          setMessages((prev) => {
            const fresh = new Map(newMessages.map((m: Message) => [m.id, m]));
            const merged = prev.map((m) => fresh.get(m.id) ?? m);
            const existing = new Set(prev.map((m) => m.id));
            const incoming = newMessages.filter((m: Message) => !existing.has(m.id));
            return incoming.length > 0 ? [...merged, ...incoming].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : merged;
          });
        }).catch(() => {});
      }
      api.getConversations().then((convs: ConversationItem[]) => setConversations(convs)).catch(() => {});
    }
  }, [api, setMessages, setConversations, messagesRef, selectedIdRef, selectedTypeRef]);

  useWebSocket({
    authUser: { id: "" }, // Will be filled by parent
    selectedId,
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
    onTypingStop: handleTypingStop,
    onPresence: handlePresence,
    onReadReceipt: handleReadReceipt,
    onReactionUpdate: handleReactionUpdate,
    onDelete: handleWSDelete,
    onEdit: handleWSEdit,
    onCatchUpRequested: handleCatchUp,
  });

  return {
    handleNewMessage,
    handleTyping,
    handleTypingStop,
    handlePresence,
    handleReadReceipt,
    handleReactionUpdate,
    handleWSDelete,
    handleWSEdit,
    handleCatchUp,
  };
}