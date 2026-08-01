"use client";

import { useState, useCallback, useRef } from "react";
import { api, Message, MessagePage } from "@/lib/api";
import { PAGE_SIZE, ConvType, byCreatedAsc } from "../types";

export function useMessagePagination(saveMessagesToDB?: (msgs: Message[]) => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesRef = useRef<Message[]>([]);
  const hasMoreRef = useRef(false);
  const loadingOlderRef = useRef(false);

  const syncRefs = useCallback(() => {
    messagesRef.current = messages;
    hasMoreRef.current = hasMore;
    loadingOlderRef.current = loadingOlder;
  }, [messages, hasMore, loadingOlder]);

  const fetchPage = useCallback(
    (id: string, type: ConvType, before?: string): Promise<MessagePage> =>
      type === "room"
        ? api.getRoomMessages(id, PAGE_SIZE, before)
        : api.getMessages(id, PAGE_SIZE, before),
    []
  );

  const refreshCurrent = useCallback(async (id: string | null, type: ConvType | null) => {
    if (!id || !type) return;
    try {
      const page = await fetchPage(id, type);
      setMessages((prev) => {
        if (prev.length === 0) return page.messages;
        const fresh = new Map(page.messages.map((m) => [m.id, m]));
        const merged = prev.map((m) => fresh.get(m.id) ?? m);
        const existing = new Set(prev.map((m) => m.id));
        const incoming = page.messages.filter((m) => !existing.has(m.id));
        if (incoming.length === 0) return merged;
        const result = [...merged, ...incoming].sort(byCreatedAsc);
        if (saveMessagesToDB) saveMessagesToDB(result);
        return result;
      });
    } catch {
      /* ignore */
    }
  }, [fetchPage, saveMessagesToDB]);

  const loadOlder = useCallback(async (id: string | null, type: ConvType | null) => {
    if (!id || !type || loadingOlderRef.current || !hasMoreRef.current) return;
    syncRefs();
    const oldest = messagesRef.current[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await fetchPage(id, type, oldest.id);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m) => !existing.has(m.id));
        const result = [...older, ...prev];
        if (saveMessagesToDB && page.messages.length > 0) saveMessagesToDB(page.messages);
        return result;
      });
      setHasMore(page.has_more);
    } catch {
      /* keep current messages */
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchPage, saveMessagesToDB, syncRefs]);

  const loadConversation = useCallback(
    async (
      id: string,
      type: ConvType,
      cachedMessages: Message[],
      saveMessagesToDB: (msgs: Message[]) => void,
    ) => {
      setHasMore(false);
      setFirstUnreadId(null);
      setUnreadCount(0);
      setLoadingOlder(false);

      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      }

      try {
        const page = await fetchPage(id, type);
        setMessages(page.messages);
        saveMessagesToDB(page.messages);
        setHasMore(page.has_more);
        setFirstUnreadId(page.first_unread_id ?? null);
        setUnreadCount(page.unread_count);
      } catch {
        if (cachedMessages.length === 0) setMessages([]);
      }
    },
    [fetchPage]
  );

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      const updated = [...prev, message].sort(byCreatedAsc);
      return updated;
    });
  }, []);

  return {
    messages,
    setMessages,
    hasMore,
    setHasMore,
    loadingOlder,
    firstUnreadId,
    unreadCount,
    messagesRef,
    refreshCurrent,
    loadOlder,
    loadConversation,
    appendMessage,
    fetchPage,
  };
}