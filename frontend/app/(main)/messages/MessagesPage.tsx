"use client";

import { useState, useCallback, Suspense, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/authStore";
import { useNotificationStore } from "@/lib/notificationStore";
import { api, Message, ChatRoomMemberResponse, MessageSendData, Conversation, User } from "@/lib/api";
import { useIndexedDBMessages, useOutbox } from "@/hooks/useIndexedDB";
import { useE2EEncryption } from "@/hooks/useE2EEncryption";
import { wsClient } from "@/lib/ws";
import { MaterialIcon } from "./helpers";
import { useDebounce } from "@/hooks/useDebounce";
import { Virtuoso } from "react-virtuoso";
import ConversationItem from "./ConversationItem";
import GlobalSearchPanel from "./components/GlobalSearchPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { SelectedConvType, PAGE_SIZE, byCreatedAsc } from "./types";
import { buildSelectedConv } from "./utils/conversationHelpers";
import { markNotifsReadMatching } from "./utils/notificationSync";

const ChatPanel = dynamic(() => import("./ChatPanel").then((mod) => mod.default), {
  loading: () => <ChatPanelSkeleton />,
  ssr: false,
});
const NewChatModal = dynamic(() => import("./NewChatModal").then((mod) => mod.default), { ssr: false });
const ForwardModal = dynamic(() => import("./ForwardModal").then((mod) => mod.default), { ssr: false });
const StarredMessagesModal = dynamic(() => import("./StarredMessagesModal").then((mod) => mod.default), { ssr: false });
const MediaGalleryModal = dynamic(() => import("./components/MediaGalleryModal").then((mod) => mod.default), { ssr: false });
const ArchivedConversationsModal = dynamic(() => import("./components/ArchivedConversationsModal").then((mod) => mod.default), { ssr: false });
const ThirdPane = dynamic(() => import("./ThirdPane").then((mod) => mod.default), { ssr: false });
const SafetyNumberDialog = dynamic(() => import("@/components/ui/SafetyNumberDialog").then((mod) => mod.default), { ssr: false });

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

export default function MessagesPage() {
  const { user: authUser } = useAuthStore();
  const markNotifsRead = useNotificationStore((s) => s.markReadMatching);
  const storeNotifications = useNotificationStore((s) => s.notifications);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<SelectedConvType | null>(null);
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
  const [showStarred, setShowStarred] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Message[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, Map<string, string>>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, boolean>>(new Map());
  const [showSafetyNumber, setShowSafetyNumber] = useState(false);

  const e2e = useE2EEncryption();

  const selectedIdRef = useRef(selectedId);
  const selectedTypeRef = useRef(selectedType);
  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  const loadingOlderRef = useRef(loadingOlder);
  const cachedMessagesRef = useRef<Message[]>([]);
  const saveMessagesToDBRef = useRef<(messages: Message[]) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    selectedIdRef.current = selectedId;
    selectedTypeRef.current = selectedType;
    messagesRef.current = messages;
    hasMoreRef.current = hasMore;
    loadingOlderRef.current = loadingOlder;
  }, [selectedId, selectedType, messages, hasMore, loadingOlder]);

  const { cachedMessages, saveMessages: saveMessagesToDB } = useIndexedDBMessages(selectedId, selectedType);

  useEffect(() => {
    cachedMessagesRef.current = cachedMessages;
    saveMessagesToDBRef.current = saveMessagesToDB as (messages: Message[]) => Promise<void>;
  }, [cachedMessages, saveMessagesToDB]);
  const { outboxMessages, processOutbox, addMessage: addToOutbox } = useOutbox();

  // Initial load: conversations first (non-blocking on the user list)
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      try {
        const convs = await api.getConversations();
        if (!cancelled) setConversations(convs);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    api
      .searchUsersServer("", { limit: 100 })
      .then((users) => {
        if (cancelled) return;
        setAllUsers(users.items.filter((u) => u.id !== authUser.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Global search
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!globalSearchQuery.trim()) { if (!cancelled) setGlobalSearchResults([]); return; }
      try {
        const results = await api.searchMessages(globalSearchQuery, 50);
        if (!cancelled) setGlobalSearchResults(results);
      } catch { if (!cancelled) setGlobalSearchResults([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [globalSearchQuery]);

  // WebSocket callbacks
  const handleNewMessage = useCallback((_conversationId: string, message: Message) => {
    if (selectedIdRef.current === _conversationId) {
      setMessages((prev) => {
        // Check if message already exists (by ID)
        if (prev.some((m) => m.id === message.id)) return prev;
        // Replace optimistic sending message if present
        const hasSending = prev.some((m) => m.sending && m.optimistic);
        const next = hasSending
          ? prev.map((m) => (m.sending && m.optimistic ? message : m))
          : [...prev, message];
        return next.sort(byCreatedAsc);
      });
      // The message just arrived in the open conversation, so it is effectively
      // read: reset the server-side unread bucket and notify the sender.
      if (wsClient.isConnected()) {
        wsClient.markRead(_conversationId, message.id);
      }
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === _conversationId
          ? { ...c, last_message: message, unread_count: c.id !== selectedIdRef.current ? c.unread_count + 1 : c.unread_count }
          : c
      )
    );
  }, []);

  const handleTyping = useCallback((conversationId: string, userId: string) => {
    setTypingUsers((prev) => { const next = new Map(prev); const ct = next.get(conversationId) || new Map(); ct.set(userId, ""); next.set(conversationId, ct); return next; });
  }, []);
  const handleTypingStop = useCallback((conversationId: string, userId: string) => {
    setTypingUsers((prev) => { const next = new Map(prev); const ct = next.get(conversationId); if (ct) { ct.delete(userId); if (ct.size === 0) next.delete(conversationId); } return next; });
  }, []);
  const handlePresence = useCallback((userId: string, status: "online" | "offline") => {
    setOnlineUsers((prev) => { const next = new Map(prev); next.set(userId, status === "online"); return next; });
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
      // Use the catch-up endpoint to fetch all messages newer than the oldest we have
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
      api.getConversations().then((convs) => setConversations(convs)).catch(() => {});
    }
  }, []);

  useWebSocket({
    authUser, selectedId,
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

  // Deep-link
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    const msg = params.get("msg");
    const userId = params.get("user") || params.get("dm");
    if (room) {
      window.history.replaceState(null, "", "/messages");
      queueMicrotask(() => { setSelectedId(room); setSelectedType("room"); if (msg) setTargetMessageId(msg); });
    } else if (userId) {
      window.history.replaceState(null, "", "/messages");
      queueMicrotask(() => { setSelectedId(userId); setSelectedType("direct"); });
    }
  }, []);

  // Load conversation
  useEffect(() => {
    if (!selectedId || !selectedType) return;
    let cancelled = false;
    (async () => {
      if (cachedMessagesRef.current.length > 0) setMessages(cachedMessagesRef.current);
      setHasMore(false);
      setFirstUnreadId(null);
      setUnreadCount(0);
      setLoadingOlder(false);
      try {
        const page = selectedType === "room"
          ? await api.getRoomMessages(selectedId, PAGE_SIZE)
          : await api.getMessages(selectedId, PAGE_SIZE);
        if (cancelled) return;
        setMessages(page.messages);
        saveMessagesToDBRef.current(page.messages);
        setHasMore(page.has_more);
        setFirstUnreadId(page.first_unread_id ?? null);
        setUnreadCount(page.unread_count);
        setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c));
        // Opening the conversation counts as "read": tell the server through
        // the WebSocket so the denormalized unread counter also resets.
        const newest = page.messages[page.messages.length - 1];
        if (newest && wsClient.isConnected()) {
          wsClient.markRead(selectedId, newest.id);
        }
      } catch { if (!cancelled && cachedMessagesRef.current.length === 0) setMessages([]); }
      try {
        const pins = selectedType === "room" ? await api.getRoomPinned(selectedId) : await api.getDmPinned(selectedId);
        if (!cancelled) setPinnedMessages(pins);
      } catch { if (!cancelled) setPinnedMessages([]); }
      if (selectedType === "room") {
        try { const room = await api.getRoom(selectedId); if (!cancelled) setRoomMembers(room.members || []); }
        catch { if (!cancelled) setRoomMembers([]); }
      } else { if (!cancelled) setRoomMembers([]); }
    })();
    return () => { cancelled = true; };
  }, [selectedId, selectedType]);

  // Notification sync
  useEffect(() => { markNotifsReadMatching(selectedId, selectedType, markNotifsRead); }, [selectedId, selectedType, markNotifsRead, storeNotifications]);

  // Load older until target found
  const loadOlder = useCallback(async () => {
    const id = selectedIdRef.current;
    const type = selectedTypeRef.current;
    if (!id || !type || loadingOlderRef.current || !hasMoreRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = type === "room" ? await api.getRoomMessages(id, PAGE_SIZE, oldest.id) : await api.getMessages(id, PAGE_SIZE, oldest.id);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m: Message) => !existing.has(m.id));
saveMessagesToDBRef.current(older);
         return [...older, ...prev];
       });
       setHasMore(page.has_more);
     } catch (error) {
       console.error('Failed to load older messages:', error);
     } finally {
setLoadingOlder(false);
    }
  }, []);

   useEffect(() => {
     if (!targetMessageId || !selectedId) return;
    if (messages.some((m) => m.id === targetMessageId)) return;
    if (hasMore && !loadingOlder) loadOlder();
  }, [targetMessageId, selectedId, messages, hasMore, loadingOlder, loadOlder]);

  // Outbox
  useEffect(() => {
    const handleOnline = () => {
      if (outboxMessages.length > 0) {
        processOutbox(async (data, conversationId, conversationType) =>
          conversationType === "room" ? api.sendRoomMessage(conversationId, data) : api.sendMessage(data)
        );
      }
    };
    window.addEventListener("online", handleOnline);
    if (navigator.onLine && outboxMessages.length > 0) handleOnline();
    return () => window.removeEventListener("online", handleOnline);
  }, [outboxMessages, processOutbox]);

  const tempIdCounterRef = useRef(0);

  const handleSend = async (data: MessageSendData) => {
    if (!selectedId || !selectedType) return;
    const body = data.body || "";
    const urlRegex = /(https?::\/\/[^\s]+)/g;
    const urls = body.match(urlRegex);
    const previewPromise = urls && urls.length > 0
      ? api.getLinkPreview(urls[0]).catch(() => null)
      : Promise.resolve(null);

    tempIdCounterRef.current += 1;
    const tempId = `temp-${tempIdCounterRef.current}-${Date.now()}`;
    const replyTo = data.reply_to_id
      ? messagesRef.current.find((m) => m.id === data.reply_to_id)
      : undefined;
    const optimistic: Message = {
      id: tempId,
      sender_id: authUser?.id || "",
      receiver_id: data.receiver_id,
      room_id: data.room_id,
      reply_to_id: data.reply_to_id,
      kind: data.kind || "text",
      body: data.body,
      attachment_url: data.attachment_url,
      attachment_type: data.attachment_type,
      attachment_name: data.attachment_name,
      metadata: data.metadata,
      disappear_at: data.disappear_at,
      read: true,
      e2e_encrypted: selectedType === "direct",
      created_at: new Date().toISOString(),
      reply_to: replyTo,
      optimistic: true,
      sending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, last_message: optimistic } : c));

    // Prepare message data for WS
    let messageData: MessageSendData & { temp_id?: string } = {
      ...data,
      temp_id: tempId, // Include temp_id to match optimistic message
    };

    // E2E encryption for DM conversations
    if (selectedType === "direct" && data.body && data.kind === "text") {
      const encrypted = await e2e.encryptMessage(selectedId, data.body);
      if (encrypted) {
        messageData = {
          ...messageData,
          body: encrypted.ciphertext,
          metadata: { ...(data.metadata || {}), e2e_message: encrypted.message, e2e_encrypted: true },
        };
      }
    }

    try {
      if (wsClient.isConnected()) {
        // Send via WebSocket
        wsClient.sendMessage(selectedId, messageData);
        // The real message will arrive via WS push (handleNewMessage)
        // and replace the optimistic one
      } else {
        // Fallback to REST when WS not connected
        const msg = selectedType === "room" ? await api.sendRoomMessage(selectedId, data) : await api.sendMessage(data);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== msg.id)
            .map((m) => (m.id === tempId ? msg : m))
        );
        setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, last_message: msg } : c));
        const preview = await previewPromise;
        if (preview) {
          const withPreview = { ...msg, metadata: { ...(msg.metadata || {}), link_preview: preview } };
          setMessages((prev) => prev.map((m) => m.id === msg.id ? withPreview : m));
          setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, last_message: withPreview } : c));
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, sending: false, failed: true } : m));
      addToOutbox(data, selectedId, selectedType);
    }
  };

  const handleTogglePin = async (m: Message) => {
    try {
      const updated = await api.pinMessage(m.id);
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, pinned: updated.pinned } : x));
      const id = selectedIdRef.current; const type = selectedTypeRef.current;
      if (id && type) {
        const pins = type === "room" ? await api.getRoomPinned(id) : await api.getDmPinned(id);
        setPinnedMessages(pins);
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleEditMessage = async (messageId: string, _convId: string, body: string) => {
    try {
      await api.editMessage(messageId, body);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, body, edited: true, edited_at: new Date().toISOString() } : m));
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteMessage = async (messageId: string, _convId: string) => {
    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const handleForwardMessage = useCallback(async (message: Message, targetId: string, targetType: "dm" | "room") => {
    setForwarding(true);
    try {
      await api.forwardMessage(
        message.id,
        targetType === "dm" ? targetId : undefined,
        targetType === "room" ? targetId : undefined
      );
      setForwardMessage(null);
      setSelectedId(targetId);
      setSelectedType(targetType === "room" ? "room" : "direct");
      setTargetMessageId(null);
      if (!conversations.some((c) => c.id === targetId)) {
        api.getConversations().then((convs) => setConversations(convs)).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to forward message:", e);
      alert("Error al reenviar el mensaje");
    } finally {
      setForwarding(false);
    }
  }, [conversations]);

  const handleShowMediaGallery = useCallback(() => {
    if (selectedId && selectedType) {
      setShowMediaGallery(true);
    }
  }, [selectedId, selectedType]);

  const handleToggleStar = useCallback(async (message: Message) => {
    try {
      await api.toggleStar(message.id);
      setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, starred: !m.starred } : m));
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  }, []);

  const handlePinConv = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.pinConversation(convType, convId);
      setConversations((prev) => [...prev].map((c) => c.id === convId ? { ...c, is_pinned: true } : c).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  }, []);
  const handleUnpinConv = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.unpinConversation(convType, convId);
      setConversations((prev) => [...prev].map((c) => c.id === convId ? { ...c, is_pinned: false } : c).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
    } catch (error) {
      console.error('Failed to unpin conversation:', error);
    }
  }, []);

  const handleExportChat = useCallback(async (convType: "dm" | "room", convId: string, convName: string) => {
    const format = confirm("Exportar como JSON? (Cancelar = TXT)") ? "json" : "txt";
    try {
      const blob = convType === "room" ? await api.exportRoomChat(convId, format) : await api.exportDmChat(convId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `chat-${convName}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { alert("Error al exportar el chat"); }
  }, []);

  const selectConv = (id: string, type: SelectedConvType) => {
    setTargetMessageId(null);
    setSelectedId(id);
    setSelectedType(type);
    if (!conversations.some((c) => c.id === id)) {
      api.getConversations().then((convs) => setConversations(convs)).catch(() => {});
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const selectedConv = buildSelectedConv(selectedId, selectedType, conversations, allUsers);

  const filtered = (debouncedSearch
    ? conversations.filter((c) => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : conversations
  ).filter((c) => !c.is_archived && !c.is_hidden);

  const handleHideConv = async (convType: "dm" | "room", convId: string) => {
    try {
      await api.hideConversation(convType, convId);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, is_archived: true, is_hidden: true } : c));
      if (selectedId === convId) {
        setSelectedId(null);
        setSelectedType(null);
        setMessages([]);
        setRoomMembers([]);
      }
    } catch (error) {
      console.error('Failed to hide conversation:', error);
    }
  };

  const handleUnhideConv = async (convType: "dm" | "room", convId: string) => {
    try {
      await api.unhideConversation(convType, convId);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, is_archived: false, is_hidden: false } : c));
    } catch (error) {
      console.error('Failed to unhide conversation:', error);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try { await api.leaveRoom(roomId); setConversations((prev) => prev.filter((c) => c.id !== roomId)); setSelectedId(null); setSelectedType(null); setMessages([]); setRoomMembers([]); } catch (err) { alert(err instanceof Error ? err.message : "Error al salir del grupo"); }
  };

  return (
    <div className="h-content -my-6 md:-my-8 flex flex-col">
      {!selectedId && (
        <div className="md:hidden mb-4">
          <h1 className="font-display text-headline-lg text-primary">
            <MaterialIcon name="mail" className="text-primary mr-2 align-middle" filled />La Lechuza
          </h1>
        </div>
      )}
      <div className="flex-1 flex rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest shadow-sm min-h-0">
        <div className={`${selectedId ? "hidden xl:flex" : "flex"} flex-col w-full xl:w-96 border-r border-outline-variant/20`}>
          <div className="p-4 border-b border-outline-variant/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-title-md font-display text-on-surface">Mensajes</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowStarred(true)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Mensajes destacados">
                  <MaterialIcon name="star" className="text-xl" />
                </button>
                <button onClick={() => setShowArchived(true)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Conversaciones archivadas">
                  <MaterialIcon name="archive" className="text-xl" />
                </button>
                <button onClick={() => setShowGlobalSearch(!showGlobalSearch)} className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${showGlobalSearch ? "bg-primary text-on-primary" : "hover:bg-surface-container-high text-on-surface-variant"}`} title="Buscar mensajes globalmente">
                  <MaterialIcon name="search" className="text-xl" />
                </button>
                <button onClick={() => setShowNewChat(true)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
                  <MaterialIcon name="edit" className="text-xl" />
                </button>
              </div>
            </div>
            {showGlobalSearch && (
              <GlobalSearchPanel
                query={globalSearchQuery}
                onQueryChange={setGlobalSearchQuery}
                results={globalSearchResults}
                onSelectResult={(msg) => {
                  setShowGlobalSearch(false);
                  selectConv(msg.room_id || msg.receiver_id || msg.sender_id, msg.room_id ? "room" : "direct");
                  setTargetMessageId(msg.id);
                }}
              />
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar conversaciones..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-full bg-surface-container-high text-on-surface text-label-md placeholder:text-on-surface-variant outline-none"
              />
              <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3" />
                <p className="text-on-surface-variant text-label-sm">Cargando lechuzas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MaterialIcon name="inbox" className="text-5xl text-outline-variant mb-3" />
                <p className="text-on-surface-variant text-body-md text-center">{search ? "Sin resultados" : "Aún no tienes conversaciones"}</p>
              </div>
            ) : (
              <Virtuoso
                data={filtered}
                className="h-full"
                scrollerRef={(ref) => (ref as HTMLElement | null)?.classList?.add("no-scrollbar")}
                itemContent={(_, conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === selectedId}
                    onlineUsers={onlineUsers}
                    onClick={() => selectConv(conv.id, conv.type as SelectedConvType)}
                    currentUserId={authUser?.id}
                  />
                )}
              />
            )}
          </div>
        </div>

        <div className={`${selectedId ? "flex" : "hidden xl:flex"} flex-1 flex-col min-w-0`}>
          {selectedConv ? (
            <Suspense fallback={<ChatPanelSkeleton />}>
              <ChatPanel
                messages={messages}
                selectedConv={selectedConv}
                onSend={handleSend}
                onBack={() => { setSelectedId(null); setSelectedType(null); setRoomMembers([]); }}
                showBack
                roomMembers={selectedType === "room" ? roomMembers : undefined}
                onHideConversation={handleHideConv}
                onLeaveRoom={handleLeaveRoom}
                onRefresh={() => {
                  const id = selectedIdRef.current; const type = selectedTypeRef.current;
                  if (id && type) {
                    const pageFn = type === "room" ? api.getRoomMessages(id, PAGE_SIZE) : api.getMessages(id, PAGE_SIZE);
                    pageFn.then((page) => {
                      setMessages((prev) => {
                        const fresh = new Map(page.messages.map((m: Message) => [m.id, m]));
                        const merged = prev.map((m) => fresh.get(m.id) ?? m);
                        const existing = new Set(prev.map((m) => m.id));
                        const incoming = page.messages.filter((m: Message) => !existing.has(m.id));
                        return incoming.length > 0 ? [...merged, ...incoming].sort(byCreatedAsc) : merged;
                      });
                    }).catch(() => {});
                  }
                }}
                hasMore={hasMore}
                loadingOlder={loadingOlder}
                onLoadOlder={loadOlder}
                firstUnreadId={firstUnreadId}
                unreadCount={unreadCount}
                pinnedMessages={pinnedMessages}
                onTogglePin={handleTogglePin}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onForwardMessage={(message) => setForwardMessage(message)}
                targetMessageId={targetMessageId}
                typingUsers={typingUsers.get(selectedConv.id ?? "") || new Map()}
                onlineUsers={onlineUsers}
                onToggleStar={handleToggleStar}
                onShowMediaGallery={handleShowMediaGallery}
                e2eEncrypted={selectedType === "direct"}
                e2eVerified={e2e.safetyNumberStates[selectedId || ""]?.verified ?? false}
                onE2EClick={selectedType === "direct" ? () => {
                  if (selectedId) e2e.loadSafetyNumber(selectedId);
                  setShowSafetyNumber(true);
                } : undefined}
                isPinned={!!selectedConversation?.is_pinned}
                isArchived={!!selectedConversation?.is_archived}
                onPinConversation={handlePinConv}
                onUnpinConversation={handleUnpinConv}
                onArchiveRoom={async (roomId) => {
                  try {
                    await api.archiveRoom(roomId);
                    setConversations((prev) => prev.map((c) => c.id === roomId ? { ...c, is_archived: true, is_hidden: true } : c));
                    if (selectedId === roomId) {
                      setSelectedId(null);
                      setSelectedType(null);
                      setMessages([]);
                      setRoomMembers([]);
                    }
                  } catch (error) {
                    console.error('Failed to archive room:', error);
                  }
                }}
                onUnarchiveRoom={async (roomId) => {
                  try {
                    await api.unarchiveRoom(roomId);
                    setConversations((prev) => prev.map((c) => c.id === roomId ? { ...c, is_archived: false, is_hidden: false } : c));
                  } catch (error) {
                    console.error('Failed to unarchive room:', error);
                  }
                }}
                onArchiveConversation={handleHideConv}
                onUnarchiveConversation={handleUnhideConv}
                onExportChat={handleExportChat}
              />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-24 h-24 rounded-full bg-secondary-container/30 flex items-center justify-center mb-4">
                <MaterialIcon name="mail" className="text-5xl text-secondary" filled />
              </div>
              <h3 className="font-display text-headline-lg text-on-surface mb-2">La Lechuza</h3>
              <p className="text-on-surface-variant text-body-md max-w-sm">Selecciona una conversación para empezar a intercambiar pergaminos</p>
            </div>
          )}
        </div>

        {selectedConversation && selectedConversation.type === "direct" && (
          <Suspense fallback={<div className="hidden 2xl:flex flex-col w-72 border-l border-outline-variant/20 bg-surface-container-low p-6 animate-pulse space-y-4">
            <div className="w-24 h-24 rounded-full bg-surface-container-high mx-auto" />
            <div className="h-6 w-1/2 mx-auto bg-surface-container-high rounded" />
            <div className="h-6 w-1/3 mx-auto bg-surface-container-high rounded" />
            <div className="h-8 w-full bg-surface-container-high rounded" />
          </div>}>
            <ThirdPane selectedConv={selectedConversation} messageCount={messages.length} />
          </Suspense>
        )}
      </div>

      {showNewChat && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <NewChatModal
            allUsers={allUsers}
            onSelectUser={(id) => { setShowNewChat(false); selectConv(id, "direct"); }}
            onSelectRoom={(id) => { setShowNewChat(false); selectConv(id, "room"); }}
            onClose={() => setShowNewChat(false)}
          />
        </Suspense>
      )}

      {forwardMessage && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <ForwardModal
            message={forwardMessage}
            onForward={handleForwardMessage}
            forwarding={forwarding}
            onClose={() => setForwardMessage(null)}
          />
        </Suspense>
      )}

      {showStarred && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <StarredMessagesModal
            onSelectMessage={(msg) => {
              setShowStarred(false);
              selectConv(msg.room_id || msg.receiver_id || msg.sender_id, msg.room_id ? "room" : "direct");
              setTargetMessageId(msg.id);
            }}
            onClose={() => setShowStarred(false)}
          />
        </Suspense>
      )}

      {showMediaGallery && selectedConv && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <MediaGalleryModal
            convId={selectedConv.id}
            convType={selectedConv.type === "room" ? "room" : "dm"}
            convName={selectedConv.name}
            onClose={() => setShowMediaGallery(false)}
          />
        </Suspense>
      )}

      {showArchived && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <ArchivedConversationsModal
            onClose={() => setShowArchived(false)}
            onSelectConversation={(conv) => {
              setShowArchived(false);
              selectConv(conv.id, conv.type as "direct" | "room");
            }}
          />
        </Suspense>
      )}
      {showSafetyNumber && selectedId && selectedType === "direct" && (
        <Suspense fallback={null}>
          <SafetyNumberDialog
            open={showSafetyNumber}
            onClose={() => setShowSafetyNumber(false)}
            remoteUserId={selectedId}
            remoteUserName={conversations.find((c) => c.id === selectedId)?.name || "Usuario"}
            safetyNumber={e2e.safetyNumberStates[selectedId]?.safetyNumber ?? null}
            verified={e2e.safetyNumberStates[selectedId]?.verified ?? false}
            loading={e2e.safetyNumberStates[selectedId]?.loading ?? false}
            onVerify={() => e2e.verifySafetyNumber(selectedId)}
          />
        </Suspense>
      )}
    </div>
  );
}