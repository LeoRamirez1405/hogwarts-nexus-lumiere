"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, Message } from "@/lib/api";
import { PAGE_SIZE, byCreatedAsc } from "../types";
import type { SelectedConvType, ChatRoomMemberResponse } from "../types";

interface WsClient {
  isConnected: () => boolean;
  markRead: (conversationId: string, messageId: string) => void;
}

interface UseMessagesOptions {
  selectedId: string | null;
  selectedType: SelectedConvType | null;
  wsClient: WsClient;
}

export function useMessages({ selectedId, selectedType, wsClient }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [roomMembers, setRoomMembers] = useState<ChatRoomMemberResponse[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  const loadingOlderRef = useRef(loadingOlder);
  const cachedMessagesRef = useRef<Message[]>([]);
  const saveMessagesToDBRef = useRef<(messages: Message[]) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    messagesRef.current = messages;
    hasMoreRef.current = hasMore;
    loadingOlderRef.current = loadingOlder;
  }, [messages, hasMore, loadingOlder]);

  // Load conversation
  useEffect(() => {
    if (!selectedId || !selectedType) return;
    let cancelled = false;
    const id = selectedId;
    const type = selectedType;

    // Members and pinned messages load in PARALLEL with the message page so
    // the members panel doesn't wait on the heavier message fetch.
    const fetchPins = async () => {
      try {
        const pins = type === "room"
          ? await api.getRoomPinned(id)
          : await api.getDmPinned(id);
        if (!cancelled) setPinnedMessages(pins);
      } catch {
        if (!cancelled) setPinnedMessages([]);
      }
    };
    const fetchMembers = async () => {
      if (type !== "room") {
        if (!cancelled) setRoomMembers([]);
        return;
      }
      setMembersLoading(true);
      try {
        const room = await api.getRoom(id);
        if (!cancelled) setRoomMembers(room.members || []);
      } catch {
        if (!cancelled) setRoomMembers([]);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    };
    fetchPins();
    fetchMembers();

    (async () => {
      if (cachedMessagesRef.current.length > 0) setMessages(cachedMessagesRef.current);
      setHasMore(false);
      setFirstUnreadId(null);
      setUnreadCount(0);
      setLoadingOlder(false);
      try {
        const page = type === "room"
          ? await api.getRoomMessages(id, PAGE_SIZE)
          : await api.getMessages(id, PAGE_SIZE);
        if (cancelled) return;
        setMessages(page.messages);
        saveMessagesToDBRef.current(page.messages);
        setHasMore(page.has_more);
        setFirstUnreadId(page.first_unread_id ?? null);
        setUnreadCount(page.unread_count);
        const newest = page.messages[page.messages.length - 1];
        if (newest && wsClient.isConnected()) {
          wsClient.markRead(id, newest.id);
        }
      } catch {
        if (!cancelled && cachedMessagesRef.current.length === 0) setMessages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, selectedType, wsClient]);

  const loadOlder = useCallback(async () => {
    const id = selectedId;
    const type = selectedType;
    if (!id || !type || loadingOlderRef.current || !hasMoreRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = type === "room"
        ? await api.getRoomMessages(id, PAGE_SIZE, oldest.id)
        : await api.getMessages(id, PAGE_SIZE, oldest.id);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m: Message) => !existing.has(m.id));
        saveMessagesToDBRef.current(older);
        return [...older, ...prev];
      });
      setHasMore(page.has_more);
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedId, selectedType]);

  // Load older until target found
  useEffect(() => {
    if (!targetMessageId || !selectedId) return;
    if (messages.some((m) => m.id === targetMessageId)) return;
    if (hasMore && !loadingOlder) loadOlder();
  }, [targetMessageId, selectedId, messages, hasMore, loadingOlder, loadOlder]);

  const handleCatchUp = useCallback(() => {
    const id = selectedId;
    const type = selectedType;
    if (id && type) {
      const oldest = messagesRef.current[0];
      if (oldest) {
        api.getMessagesSince(oldest.id, PAGE_SIZE).then((newMessages) => {
          setMessages((prev) => {
            const fresh = new Map(newMessages.map((m: Message) => [m.id, m]));
            const merged = prev.map((m) => fresh.get(m.id) ?? m);
            const existing = new Set(prev.map((m) => m.id));
            const incoming = newMessages.filter((m: Message) => !existing.has(m.id));
            return incoming.length > 0 ? [...merged, ...incoming].sort(byCreatedAsc) : merged;
          });
        }).catch(() => {});
      }
    }
  }, [selectedId, selectedType]);

  const handleRefresh = useCallback(async () => {
    const id = selectedId;
    const type = selectedType;
    if (id && type) {
      const pageFn = type === "room" ? api.getRoomMessages(id, PAGE_SIZE) : api.getMessages(id, PAGE_SIZE);
      const page = await pageFn;
      setMessages((prev) => {
        const fresh = new Map(page.messages.map((m: Message) => [m.id, m]));
        const merged = prev.map((m) => fresh.get(m.id) ?? m);
        const existing = new Set(prev.map((m) => m.id));
        const incoming = page.messages.filter((m: Message) => !existing.has(m.id));
        return incoming.length > 0 ? [...merged, ...incoming].sort(byCreatedAsc) : merged;
      });
      if (type === "room") {
        setMembersLoading(true);
        try {
          const room = await api.getRoom(id);
          setRoomMembers(room.members || []);
        } catch {
          // keep current members on failure
        } finally {
          setMembersLoading(false);
        }
      }
    }
  }, [selectedId, selectedType]);

  // Re-fetch room members when the tab regains focus so changes made
  // elsewhere (e.g. an admin adding members from another tab/route)
  // show up without having to reselect the conversation.
  useEffect(() => {
    const refreshMembers = () => {
      if (selectedId && selectedType === "room") {
        api
          .getRoom(selectedId)
          .then((room) => setRoomMembers(room.members || []))
          .catch(() => {});
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshMembers();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [selectedId, selectedType]);

  return {
    messages,
    setMessages,
    hasMore,
    loadingOlder,
    firstUnreadId,
    unreadCount,
    pinnedMessages,
    setPinnedMessages,
    roomMembers,
    setRoomMembers,
    membersLoading,
    targetMessageId,
    setTargetMessageId,
    loadOlder,
    handleCatchUp,
    handleRefresh,
  };
}