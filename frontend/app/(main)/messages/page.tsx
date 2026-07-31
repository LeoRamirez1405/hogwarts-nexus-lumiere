"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/authStore";
import { useNotificationStore } from "@/lib/notificationStore";
import { api, Conversation, Message, MessagePage, MessageSendData, User, ChatRoomMemberResponse } from "@/lib/api";
import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "./helpers";
import ConversationItem from "./ConversationItem";
import { SelectedConv } from "./ChatPanel";
import { wsClient } from "@/lib/ws";
import { getAccessTokenFromCookie } from "@/lib/cookies";
import { useDebounce } from "@/hooks/useDebounce";
import { useIndexedDBMessages, useOutbox } from "@/hooks/useIndexedDB";

const ChatPanel = dynamic(() => import("./ChatPanel").then((mod) => mod.default), {
  loading: () => <ChatPanelSkeleton />,
  ssr: false,
});
const NewChatModal = dynamic(() => import("./NewChatModal").then((mod) => mod.default), {
  ssr: false,
});
const ThirdPane = dynamic(() => import("./ThirdPane").then((mod) => mod.default), {
  ssr: false,
});

function ChatPanelSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-16 border-b border-outline-variant/20 animate-pulse bg-surface-container-lowest" />
      <div className="flex-1 overflow-y-auto animate-pulse space-y-4 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/4 bg-surface-container-high rounded" />
              <div className="h-3 w-1/2 bg-surface-container-high rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-24 border-t border-outline-variant/20 animate-pulse bg-surface-container-lowest" />
    </div>
  );
}

const PAGE_SIZE = 30;

interface WSNewMessage {
  c: string;
  m: Message;
}

interface WSTyping {
  c: string;
  u: string;
}

interface WSPresence {
  u: string;
  s: "online" | "offline";
}

interface WSReadReceipt {
  c: string;
  m: string;
  u: string;
  ts: number;
}

interface WSReactionUpdate {
  c: string;
  m: string;
  r: Message["reactions"];
}

interface WSDelete {
  c: string;
  m: string;
}

interface WSEdit {
  c: string;
  m: Message;
}

const byCreatedAsc = (a: Message, b: Message) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

export default function MessagesPage() {
  const { user: authUser } = useAuthStore();
  const markNotifsReadMatching = useNotificationStore((s) => s.markReadMatching);
  const storeNotifications = useNotificationStore((s) => s.notifications);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"direct" | "room" | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [roomMembers, setRoomMembers] = useState<ChatRoomMemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showNewChat, setShowNewChat] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  // Typing indicator state: conversationId -> Set of {userId, username}
  const [typingUsers, setTypingUsers] = useState<Map<string, Map<string, string>>>(new Map());
  // Presence state: userId -> online/offline
  const [onlineUsers, setOnlineUsers] = useState<Map<string, boolean>>(new Map());

  // IndexedDB for offline support
  const { cachedMessages, saveMessages: saveMessagesToDB } = useIndexedDBMessages(
    selectedId,
    selectedType
  );
  const { outboxMessages, processOutbox, addMessage: addToOutbox } = useOutbox();

  // Refs to read current values inside callbacks/intervals without stale deps.
  const selectedIdRef = useRef<string | null>(null);
  const selectedTypeRef = useRef<"direct" | "room" | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const hasMoreRef = useRef(false);
  const loadingOlderRef = useRef(false);
  // Keep refs in sync after each commit (never write refs during render).
  useEffect(() => {
    selectedIdRef.current = selectedId;
    selectedTypeRef.current = selectedType;
    messagesRef.current = messages;
    hasMoreRef.current = hasMore;
    loadingOlderRef.current = loadingOlder;
  });

  const fetchPage = useCallback(
    (id: string, type: "direct" | "room", before?: string): Promise<MessagePage> =>
      type === "room"
        ? api.getRoomMessages(id, PAGE_SIZE, before)
        : api.getMessages(id, PAGE_SIZE, before),
    []
  );

  // Merge the newest page into current state: refresh existing (reactions,
  // read, pinned) and append genuinely new messages — without disturbing the
  // unread divider or older pages already loaded.
  const refreshCurrent = useCallback(async () => {
    const id = selectedIdRef.current;
    const type = selectedTypeRef.current;
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
        return [...merged, ...incoming].sort(byCreatedAsc);
      });
    } catch {
      /* ignore */
    }
  }, [fetchPage]);

  // Initial data (conversation list + users).
  useEffect(() => {
    if (!authUser) return;
    Promise.all([api.getConversations(), api.getUsers()])
      .then(([convs, users]) => {
        setConversations(convs);
        setAllUsers(users.items.filter((u) => u.id !== authUser?.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  // Online/Offline detection and outbox processing
  useEffect(() => {
    const handleOnline = () => {
      if (outboxMessages.length > 0) {
        processOutbox(async (data, conversationId, conversationType) => {
          if (conversationType === "room") {
            return api.sendRoomMessage(conversationId, data);
          }
          return api.sendMessage(data);
        });
      }
    };

    window.addEventListener("online", handleOnline);
    // Also process on mount if already online
    if (navigator.onLine && outboxMessages.length > 0) {
      handleOnline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [outboxMessages, processOutbox]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!authUser) return;

    const token = getAccessTokenFromCookie();
    if (!token) return;

    wsClient.connect(token);

    const unsubNewMessage = wsClient.on("new_message", (msg: WSNewMessage) => {
      const conversationId = msg.c;
      const message = msg.m;

      // Add message to current conversation if it's the active one
      if (selectedId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          const updated = [...prev, message].sort((a, b) =>
            a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
          );
          // Save to IndexedDB
          saveMessagesToDB(updated);
          return updated;
        });
      }

      // Update conversation list with new last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, last_message: message, unread_count: c.id !== selectedId ? c.unread_count + 1 : c.unread_count } : c
        )
      );
    });

    const unsubTyping = wsClient.on("typing", (msg: WSTyping) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const conversationTyping = next.get(msg.c) || new Map();
        conversationTyping.set(msg.u, ""); // username will be filled from conversation data
        next.set(msg.c, conversationTyping);
        return next;
      });
    });

    const unsubTypingStop = wsClient.on("typing_stop", (msg: WSTyping) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const conversationTyping = next.get(msg.c);
        if (conversationTyping) {
          conversationTyping.delete(msg.u);
          if (conversationTyping.size === 0) {
            next.delete(msg.c);
          }
        }
        return next;
      });
    });

    const unsubPresence = wsClient.on("presence", (msg: WSPresence) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(msg.u, msg.s === "online");
        return next;
      });

      // Update online status in conversation list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.type === "direct" && c.id === msg.u) {
            return { ...c, last_active_at: msg.s === "online" ? new Date().toISOString() : c.last_active_at };
          }
          if (c.type === "room") {
            // For rooms, we could update online_count
            return c;
          }
          return c;
        })
      );
    });

    const unsubReadReceipt = wsClient.on("read_receipt", (msg: WSReadReceipt) => {
      // Update message read status
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.m ? { ...m, read: true } : m
        )
      );
    });

    const unsubReactionUpdate = wsClient.on("reaction_update", (msg: WSReactionUpdate) => {
      // Update message reactions
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.m ? { ...m, reactions: msg.r } : m
        )
      );
    });

    const unsubDelete = wsClient.on("delete", (msg: WSDelete) => {
      // Remove deleted message
      setMessages((prev) => prev.filter((m) => m.id !== msg.m));
    });

    const unsubEdit = wsClient.on("edit", (msg: WSEdit) => {
      // Update edited message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.m.id ? { ...m, ...msg.m } : m
        )
      );
    });

    const unsubCatchUp = wsClient.on("catch_up_requested", () => {
      // Re-fetch conversations and current messages when app comes to foreground
      if (selectedId) {
        refreshCurrent();
      }
      api.getConversations().then(setConversations).catch(() => {});
    });

    return () => {
      unsubNewMessage();
      unsubTyping();
      unsubTypingStop();
      unsubPresence();
      unsubReadReceipt();
      unsubReactionUpdate();
      unsubDelete();
      unsubEdit();
      unsubCatchUp();
      // Don't disconnect WS on unmount - keep it alive for other pages
    };
  }, [authUser, selectedId, refreshCurrent, saveMessagesToDB]);

  // Deep-link from a mention notification: /messages?room=..&msg=..
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    const msg = params.get("msg");
    const userId = params.get("user") || params.get("dm");
    if (room) {
      window.history.replaceState(null, "", "/messages");
      queueMicrotask(() => {
        setSelectedId(room);
        setSelectedType("room");
        if (msg) setTargetMessageId(msg);
      });
    } else if (userId) {
      window.history.replaceState(null, "", "/messages");
      queueMicrotask(() => {
        // Check if an existing direct conversation exists with this user.
        setSelectedId(userId);
        setSelectedType("direct");
      });
    }
  }, []);

  // Load a conversation from scratch when the selection changes.
  useEffect(() => {
    if (!selectedId || !selectedType) return;
    let cancelled = false;
    const id = selectedId;
    const type = selectedType;

    (async () => {
      // Show cached messages immediately while fetching fresh data
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      }

      // Reset previous conversation state
      setHasMore(false);
      setFirstUnreadId(null);
      setUnreadCount(0);
      setPinnedMessages([]);
      setLoadingOlder(false);

      try {
        const page = await fetchPage(id, type);
        if (cancelled) return;
        setMessages(page.messages);
        // Save to IndexedDB for offline access
        saveMessagesToDB(page.messages);
        setHasMore(page.has_more);
        setFirstUnreadId(page.first_unread_id ?? null);
        setUnreadCount(page.unread_count);
        // Opening a conversation clears its unread badge.
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
      } catch {
        if (!cancelled && cachedMessages.length === 0) setMessages([]);
      }

      try {
        const pins = type === "room" ? await api.getRoomPinned(id) : await api.getDmPinned(id);
        if (!cancelled) setPinnedMessages(pins);
      } catch {
        if (!cancelled) setPinnedMessages([]);
      }

      if (type === "room") {
        try {
          const room = await api.getRoom(id);
          if (!cancelled) setRoomMembers(room.members || []);
        } catch {
          if (!cancelled) setRoomMembers([]);
        }
      } else if (!cancelled) {
        setRoomMembers([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedType, fetchPage, cachedMessages, saveMessagesToDB]);

  // Opening a conversation clears its related notifications (DM message, room
  // mention, or being added to a group) — so reaching the chat counts as
  // attending the notification even without clicking it in the bell.
  useEffect(() => {
    if (!selectedId || !selectedType) return;
    const id = selectedId;
    const type = selectedType;
    markNotifsReadMatching((n) => {
      if (type === "direct") return n.type === "dm_message" && n.related_id === id;
      if (n.type === "group_added") return n.related_id === id;
      if (n.type === "mention") return (n.related_id ?? "").split(":")[0] === id;
      return false;
    });
    // `storeNotifications` in deps so this re-runs once the store finishes
    // loading (the conversation may open before notifications are fetched).
  }, [selectedId, selectedType, markNotifsReadMatching, storeNotifications]);

  // Lazy-load an older page and prepend it.
  const loadOlder = useCallback(async () => {
    const id = selectedIdRef.current;
    const type = selectedTypeRef.current;
    if (!id || !type || loadingOlderRef.current || !hasMoreRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await fetchPage(id, type, oldest.id);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m) => !existing.has(m.id));
        return [...older, ...prev];
      });
      // Save older messages to IndexedDB
      if (page.messages.length > 0) {
        saveMessagesToDB(page.messages);
      }
      setHasMore(page.has_more);
    } catch {
      /* keep current messages on failure */
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchPage, saveMessagesToDB]);

  // Notification jump: keep loading older pages until the target is present.
  useEffect(() => {
    if (!targetMessageId || !selectedId) return;
    if (messages.some((m) => m.id === targetMessageId)) return;
    if (hasMore && !loadingOlder) loadOlder();
  }, [targetMessageId, selectedId, messages, hasMore, loadingOlder, loadOlder]);

  const handleSend = async (data: MessageSendData) => {
    if (!selectedId || !selectedType) return;
    try {
      const msg =
        selectedType === "room"
          ? await api.sendRoomMessage(selectedId, data)
          : await api.sendMessage(data);
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, last_message: msg } : c))
      );
    } catch (err) {
      console.error("Send failed, adding to outbox:", err);
      // Add to outbox for retry when online
      addToOutbox(data, selectedId, selectedType);
    }
  };

  const handleTogglePin = async (m: Message) => {
    try {
      const updated = await api.pinMessage(m.id);
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, pinned: updated.pinned } : x))
      );
      const id = selectedIdRef.current;
      const type = selectedTypeRef.current;
      if (id && type) {
        const pins = type === "room" ? await api.getRoomPinned(id) : await api.getDmPinned(id);
        setPinnedMessages(pins);
      }
    } catch (err) {
      console.error("Pin failed", err);
    }
  };

  const handleEditMessage = async (messageId: string, conversationId: string, body: string) => {
    try {
      await api.editMessage(messageId, body);
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, body, edited: true, edited_at: new Date().toISOString() } : m
        )
      );
      // Also send via WebSocket for real-time sync
      wsClient.editMessage(messageId, conversationId, body);
    } catch (err) {
      console.error("Edit failed", err);
    }
  };

  const handleDeleteMessage = async (messageId: string, conversationId: string) => {
    try {
      await api.deleteMessage(messageId);
      // Optimistic update
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      // Also send via WebSocket for real-time sync
      wsClient.deleteMessage(messageId, conversationId);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const selectConversation = (id: string, type: "direct" | "room") => {
    setTargetMessageId(null);
    setSelectedId(id);
    setSelectedType(type);
    // If this conversation isn't in the list yet (brand-new DM/room), pull a
    // fresh list so its name/avatar populate the header.
    if (!conversations.some((c) => c.id === id)) {
      api.getConversations().then(setConversations).catch(() => {});
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const filtered = debouncedSearch
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : conversations;

  let selectedConv: SelectedConv | null = null;
  if (selectedConversation) {
    selectedConv = {
      id: selectedConversation.id,
      name: selectedConversation.name,
      avatar_url: selectedConversation.avatar_url,
      type: selectedConversation.type as "direct" | "room",
      last_active_at: selectedConversation.last_active_at,
      online_count: selectedConversation.online_count,
    };
  } else if (selectedId && selectedType === "direct") {
    const u = allUsers.find((x) => x.id === selectedId);
    selectedConv = {
      id: selectedId,
      name: u?.name ?? "",
      avatar_url: u?.avatar_url,
      type: "direct",
      last_active_at: u?.last_active_at,
    };
  } else if (selectedId && selectedType) {
    selectedConv = { id: selectedId, name: "", type: selectedType };
  }

  const handleHideConversation = async (convType: "dm" | "room", convId: string) => {
    try {
      await api.hideConversation(convType, convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (selectedId === convId) {
        setSelectedId(null);
        setSelectedType(null);
        setMessages([]);
        setRoomMembers([]);
      }
    } catch (err) {
      console.error("Hide failed", err);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try {
      await api.leaveRoom(roomId);
      setConversations((prev) => prev.filter((c) => c.id !== roomId));
      setSelectedId(null);
      setSelectedType(null);
      setMessages([]);
      setRoomMembers([]);
    } catch (err) {
      console.error("Leave failed", err);
      alert(err instanceof Error ? err.message : "Error al salir del grupo");
    }
  };

  return (
    <div className="h-content -my-6 md:-my-8 flex flex-col">
      {!selectedId && (
        <div className="md:hidden mb-4">
          <h1 className="font-display text-headline-lg text-primary">
            <MaterialIcon
              name="mail"
              className="text-primary mr-2 align-middle"
              filled
            />
            La Lechuza
        </h1>
      </div>
      )}

      <div className="flex-1 flex rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest shadow-sm min-h-0">
        {/* Conversation List */}
        <div
          className={`${
            selectedId ? "hidden xl:flex" : "flex"
          } flex-col w-full xl:w-96 border-r border-outline-variant/20`}
        >
          <div className="p-4 border-b border-outline-variant/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-title-md font-display text-on-surface">
                Mensajes
            </h2>
              <button
                onClick={() => setShowNewChat(true)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="edit" className="text-xl" />
            </button>
          </div>
            <SearchBar
              placeholder="Buscar conversaciones..."
              value={search}
              onChange={setSearch}
              size="sm"
            />
        </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MaterialIcon
                  name="progress_activity"
                  className="text-4xl text-outline-variant animate-spin mb-3"
                />
                <p className="text-on-surface-variant text-label-sm">
                  Cargando lechuzas...
            </p>
          </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MaterialIcon
                  name="inbox"
                  className="text-5xl text-outline-variant mb-3"
                />
                <p className="text-on-surface-variant text-body-md text-center">
                  {search ? "Sin resultados" : "Aún no tienes conversaciones"}
            </p>
          </div>
            ) : (
              filtered.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === selectedId}
                  onClick={() =>
                    selectConversation(conv.id, conv.type as "direct" | "room")
                  }
                />
              ))
            )}
        </div>
      </div>

{/* Chat Panel */}
        <div
          className={`${
            selectedId ? "flex" : "hidden xl:flex"
          } flex-1 flex-col min-w-0`}
        >
          {selectedConv ? (
            <Suspense fallback={<ChatPanelSkeleton />}>
              <ChatPanel
                messages={messages}
                selectedConv={selectedConv}
                onSend={handleSend}
                onBack={() => {
                  setSelectedId(null);
                  setSelectedType(null);
                  setRoomMembers([]);
                }}
                showBack
                roomMembers={selectedType === "room" ? roomMembers : undefined}
                onHideConversation={handleHideConversation}
                onLeaveRoom={handleLeaveRoom}
                onRefresh={refreshCurrent}
                hasMore={hasMore}
                loadingOlder={loadingOlder}
                onLoadOlder={loadOlder}
                firstUnreadId={firstUnreadId}
                unreadCount={unreadCount}
                pinnedMessages={pinnedMessages}
                onTogglePin={handleTogglePin}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                targetMessageId={targetMessageId}
                typingUsers={typingUsers.get(selectedConv.id) || new Map()}
                onlineUsers={onlineUsers}
              />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-24 h-24 rounded-full bg-secondary-container/30 flex items-center justify-center mb-4">
                <MaterialIcon
                  name="mail"
                  className="text-5xl text-secondary"
                  filled
                />
            </div>
              <h3 className="font-display text-headline-lg text-on-surface mb-2">
                La Lechuza
            </h3>
              <p className="text-on-surface-variant text-body-md max-w-sm">
                Selecciona una conversacion para empezar a intercambiar pergaminos
            </p>
          </div>
          )}
        </div>

        {/* Third pane on 2xl+ */}
        {selectedConversation && selectedConversation.type === "direct" && (
          <Suspense fallback={<div className="hidden 2xl:flex flex-col w-72 border-l border-outline-variant/20 bg-surface-container-low p-6 animate-pulse space-y-4">
            <div className="w-24 h-24 rounded-full bg-surface-container-high mx-auto" />
            <div className="h-6 w-1/2 mx-auto bg-surface-container-high rounded" />
            <div className="h-6 w-1/3 mx-auto bg-surface-container-high rounded" />
            <div className="h-8 w-full bg-surface-container-high rounded" />
          </div>}>
            <ThirdPane
              selectedConv={selectedConversation}
              messageCount={messages.length}
            />
          </Suspense>
        )}
    </div>

      {showNewChat && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse">
          <div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" />
        </div>}>
          <NewChatModal
            allUsers={allUsers}
            onSelectUser={(id) => {
              setShowNewChat(false);
              selectConversation(id, "direct");
            }}
            onSelectRoom={(id) => {
              setShowNewChat(false);
              selectConversation(id, "room");
            }}
            onClose={() => setShowNewChat(false)}
          />
        </Suspense>
      )}
  </div>
  );
}
