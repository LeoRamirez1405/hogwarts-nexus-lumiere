"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { useNotificationStore } from "@/lib/notificationStore";
import { api, Conversation, Message, MessagePage, MessageSendData, User, ChatRoomMemberResponse } from "@/lib/api";
import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "./helpers";
import ConversationItem from "./ConversationItem";
import ChatPanel, { SelectedConv } from "./ChatPanel";
import NewChatModal from "./NewChatModal";
import ThirdPane from "./ThirdPane";

const PAGE_SIZE = 30;
const POLL_MS = 5000;

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
  const [showNewChat, setShowNewChat] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

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
      // Reset previous conversation state (inside async so it isn't a
      // synchronous setState in the effect body).
      setMessages([]);
      setHasMore(false);
      setFirstUnreadId(null);
      setUnreadCount(0);
      setPinnedMessages([]);
      setLoadingOlder(false);
      try {
        const page = await fetchPage(id, type);
        if (cancelled) return;
        setMessages(page.messages);
        setHasMore(page.has_more);
        setFirstUnreadId(page.first_unread_id ?? null);
        setUnreadCount(page.unread_count);
        // Opening a conversation clears its unread badge.
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
      } catch {
        if (!cancelled) setMessages([]);
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
  }, [selectedId, selectedType, fetchPage]);

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
      setHasMore(page.has_more);
    } catch {
      /* keep current messages on failure */
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchPage]);

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

  // Poll the open conversation and the conversation list.
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(() => {
      refreshCurrent();
      api.getConversations().then(setConversations).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [selectedId, refreshCurrent]);

  // Notification jump: keep loading older pages until the target is present.
  useEffect(() => {
    if (!targetMessageId || !selectedId) return;
    if (messages.some((m) => m.id === targetMessageId)) return;
    if (hasMore && !loadingOlder) loadOlder();
  }, [targetMessageId, selectedId, messages, hasMore, loadingOlder, loadOlder]);

  const handleSend = async (data: MessageSendData) => {
    if (!selectedId) return;
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
      console.error("Send failed", err);
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

  const filtered = search
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
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
              targetMessageId={targetMessageId}
            />
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
          <ThirdPane
            selectedConv={selectedConversation}
            messageCount={messages.length}
          />
        )}
    </div>

      {showNewChat && (
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
      )}
  </div>
  );
}
