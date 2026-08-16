"use client";

import { useState, useCallback, Suspense, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/authStore";
import { useNotificationStore } from "@/lib/notificationStore";
import { api, Message, PollResponse, Conversation } from "@/lib/api";
import { useOutbox } from "@/hooks/useIndexedDB";
import { useE2EEncryption } from "@/hooks/useE2EEncryption";
import { useDebounce } from "@/hooks/useDebounce";
import { Virtuoso } from "react-virtuoso";
import ConversationItem from "./ConversationItem";
import { FloatingPopover } from "./components/FloatingPopover";
import { useConversations, useMessages, useWebSocketMessages, useOutboxSync, useMessageActions, useE2ESafety } from "./hooks";
import { buildSelectedConv, selectConv } from "./utils/conversationHelpers";
import { markNotifsReadMatching } from "./utils/notificationSync";
import { MaterialIcon } from "./helpers";
import type { SelectedConvType } from "./types";
import type { ScheduledConvFilter } from "./ScheduledMessagesModal";

const ChatPanel = dynamic(() => import("./ChatPanel").then((mod) => mod.default), {
  loading: () => <ChatPanelSkeleton />,
  ssr: false,
});
const NewChatModal = dynamic(() => import("./NewChatModal").then((mod) => mod.default), { ssr: false });
const ForwardModal = dynamic(() => import("./ForwardModal").then((mod) => mod.default), { ssr: false });
const StarredMessagesModal = dynamic(() => import("./StarredMessagesModal").then((mod) => mod.default), { ssr: false });
const ScheduledMessagesModal = dynamic(() => import("./ScheduledMessagesModal").then((mod) => mod.default), { ssr: false });
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
  const markNotifsRead = useNotificationStore((s) => s.markReadByReference);
  const storeNotifications = useNotificationStore((s) => s.notifications);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<SelectedConvType | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [scheduledFilter, setScheduledFilter] = useState<ScheduledConvFilter | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Message[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, Map<string, string>>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, boolean>>(new Map());
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const [longPressMenu, setLongPressMenu] = useState<{
    conv: Conversation;
    x: number;
    y: number;
  } | null>(null);

  const selectedIdRef = useRef(selectedId);
  const selectedTypeRef = useRef(selectedType);
  const messagesRef = useRef<Message[]>([]);

  const e2e = useE2EEncryption();

  useEffect(() => {
    selectedIdRef.current = selectedId;
    selectedTypeRef.current = selectedType;
  }, [selectedId, selectedType]);

  // Stable no-op WS stub. MUST be memoized: these hooks put wsClient in effect
  // dep arrays, so a fresh inline object each render retriggers those effects,
  // which setState → re-render → new object → infinite loop ("Maximum update
  // depth exceeded"). The real socket is handled by useWebSocket internally.
  const wsClientStub = useMemo(
    () => ({
      isConnected: () => false,
      sendMessage: () => {},
      markRead: () => {},
    }),
    []
  );

  // Hooks
  const { conversations, setConversations, allUsers, loading } = useConversations(authUser);
  const messagesHook = useMessages({
    selectedId,
    selectedType,
    wsClient: wsClientStub,
    setConversations,
  });

  // Keep the page-level ref in sync so healConversationPreview (used after
  // delete/expiry) can compute the surviving newest message from real data.
  // Without this the ref stays empty and the inbox preview is cleared even
  // when other messages remain in the conversation.
  useEffect(() => {
    messagesRef.current = messagesHook.messages;
  }, [messagesHook.messages]);

  const { outboxMessages, processOutbox, addMessage: addToOutbox } = useOutbox();

  // Use WebSocket messages hook
  useWebSocketMessages({
    selectedId,
    selectedType,
    messagesRef,
    selectedIdRef,
    selectedTypeRef,
    wsClient: wsClientStub,
    setMessages: messagesHook.setMessages,
    setConversations,
    setTypingUsers,
    setOnlineUsers,
    api,
  });

  // Use outbox sync
  useOutboxSync(outboxMessages, processOutbox);

  // Use message actions
  const {
    handleSend,
    handleTogglePin,
    handleEditMessage,
    handleDeleteMessage,
    handleForwardMessage: handleForward,
    handleToggleStar,
    handleMuteConversation,
    handlePinConv,
    handleUnpinConv,
    handleExportChat,
    handleHideConv,
    handleUnhideConv,
    handleDeleteConversation,
    handleRemoveConversation,
    handleLeaveRoom,
    handleArchiveRoom,
    handleUnarchiveRoom,
  } = useMessageActions({
    authUser,
    selectedId,
    selectedType,
    messagesRef,
    wsClient: wsClientStub,
    e2e,
    setMessages: messagesHook.setMessages,
    setConversations,
    setPinnedMessages: messagesHook.setPinnedMessages,
    addToOutbox,
  });

  // Use E2E safety
  const {
    showSafetyNumber,
    setShowSafetyNumber,
    safetyNumber,
    verified,
    loading: safetyLoading,
    remoteUserName,
    handleE2EClick,
  } = useE2ESafety({ selectedId, selectedType, conversations, e2e });

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

  // Notification sync
  useEffect(() => {
    markNotifsReadMatching(selectedId, selectedType, markNotifsRead);
  }, [selectedId, selectedType, markNotifsRead, storeNotifications]);

  // Conversation selection wrapper
  const handleSelectConv = useCallback((id: string, type: SelectedConvType) => {
    selectConv(id, type, setSelectedId, setSelectedType, setTargetMessageId, conversations, setConversations, api);
  }, [conversations, setConversations]);

  const handleShowMediaGallery = useCallback(() => {
    if (selectedId && selectedType) setShowMediaGallery(true);
  }, [selectedId, selectedType]);

  const handleDeleteSelected = useCallback(async (convType: "dm" | "room", convId: string) => {
    await handleDeleteConversation(convType, convId);
    if (selectedId === convId) {
      setSelectedId(null);
      setSelectedType(null);
      messagesHook.setMessages([]);
      messagesHook.setRoomMembers([]);
    }
  }, [handleDeleteConversation, selectedId, setSelectedId, setSelectedType, messagesHook]);

  const handleForwardMessage = useCallback(async (message: Message) => {
    setForwardMessage(message);
  }, []);

  const handleForwardToTarget = useCallback(async (message: Message, targetId: string, targetType: "dm" | "room") => {
    setForwardMessage(null);
    const ok = await handleForward(message, targetId, targetType);
    if (ok) {
      handleSelectConv(targetId, targetType === "dm" ? "direct" : "room");
    }
  }, [handleForward, handleSelectConv]);

  const handlePollVote = useCallback((messageId: string, updatedPoll: PollResponse) => {
    messagesHook.setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.poll ? { ...m, poll: updatedPoll } : m
      )
    );
  }, [messagesHook]);

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const selectedConv = buildSelectedConv(selectedId, selectedType, conversations, allUsers);

  const filtered = (debouncedSearch
    ? conversations.filter((c) => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : conversations
  ).filter((c) => !c.is_archived && !c.is_hidden);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex overflow-hidden bg-surface-container-lowest min-h-0">
        <div className={`${selectedId ? "hidden xl:flex" : "flex"} flex-col w-full xl:w-96 border-r border-outline-variant/20 overflow-hidden`}>
          <div className="p-4 border-b border-outline-variant/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-title-md font-display text-on-surface">Mensajes</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowStarred(true)} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Mensajes destacados">
                  <MaterialIcon name="star" className="text-xl" />
                </button>
                <button onClick={() => { setScheduledFilter(null); setShowScheduled(true); }} className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Mensajes programados">
                  <MaterialIcon name="schedule" className="text-xl" />
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
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Buscar en todos los mensajes..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="w-full h-10 pl-4 pr-4 rounded-full bg-surface-container-high text-on-surface text-label-md placeholder:text-on-surface-variant outline-none"
                />
                <div className="mt-2 max-h-64 overflow-y-auto">
                  {globalSearchResults.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => {
                        setShowGlobalSearch(false);
                        handleSelectConv(msg.room_id || msg.receiver_id || msg.sender_id, msg.room_id ? "room" : "direct");
                        setTargetMessageId(msg.id);
                      }}
                      className="p-3 hover:bg-surface-container-high cursor-pointer border-b border-outline-variant/10"
                    >
                      <p className="text-body-sm text-on-surface">{msg.body?.slice(0, 100)}</p>
                      <p className="text-label-xs text-on-surface-variant">{new Date(msg.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
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
          <div className="flex-1 min-h-0 overflow-hidden">
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
                    onClick={() => handleSelectConv(conv.id, conv.type as SelectedConvType)}
                    onLongPress={(e) => setLongPressMenu({ conv, x: e.clientX, y: e.clientY })}
                    currentUserId={authUser?.id}
                  />
                )}
              />
            )}
          </div>
        </div>

        {longPressMenu && (
          <FloatingPopover
            clientX={longPressMenu.x}
            clientY={longPressMenu.y}
            open={!!longPressMenu}
            onRequestClose={() => setLongPressMenu(null)}
            placement="bottom"
            className="w-56"
          >
            <div className="py-1">
              <p className="px-4 py-2 text-label-xs text-on-surface-variant truncate">
                {longPressMenu.conv.name}
              </p>
              <button
                onClick={() => {
                  const convType = longPressMenu.conv.type === "room" ? "room" : "dm";
                  handleRemoveConversation(convType, longPressMenu.conv.id);
                  setLongPressMenu(null);
                }}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-body-md text-error hover:bg-error-container/30 transition-colors"
              >
                <MaterialIcon name="delete" className="text-xl" />
                Eliminar
              </button>
            </div>
          </FloatingPopover>
        )}

        <div className={`${selectedId ? "flex" : "hidden xl:flex"} flex-1 flex-col min-w-0`}>
          {selectedConv ? (
            <Suspense fallback={<ChatPanelSkeleton />}>
              <ChatPanel
                messages={messagesHook.messages}
                selectedConv={selectedConv}
                onSend={handleSend}
                onBack={() => { setSelectedId(null); setSelectedType(null); messagesHook.setRoomMembers([]); }}
                showBack
                roomMembers={selectedType === "room" ? messagesHook.roomMembers : undefined}
                membersLoading={messagesHook.membersLoading}
                onDeleteConversation={handleDeleteSelected}
                onLeaveRoom={handleLeaveRoom}
                onRefresh={messagesHook.handleRefresh}
                hasMore={messagesHook.hasMore}
                loadingOlder={messagesHook.loadingOlder}
                onLoadOlder={messagesHook.loadOlder}
                firstUnreadId={messagesHook.firstUnreadId}
                unreadCount={messagesHook.unreadCount}
                loadNonce={messagesHook.loadNonce}
                pinnedMessages={messagesHook.pinnedMessages}
                onTogglePin={handleTogglePin}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onForwardMessage={handleForwardMessage}
                targetMessageId={targetMessageId}
                typingUsers={typingUsers.get(selectedConv.id ?? "") || new Map()}
                onlineUsers={onlineUsers}
                onToggleStar={handleToggleStar}
                onShowMediaGallery={handleShowMediaGallery}
                e2eEncrypted={selectedType === "direct"}
                e2eVerified={verified}
                onE2EClick={selectedType === "direct" ? handleE2EClick : undefined}
                isPinned={!!selectedConversation?.is_pinned}
                isArchived={!!selectedConversation?.is_archived}
                onMuteConversation={handleMuteConversation}
                onPinConversation={handlePinConv}
                onUnpinConversation={handleUnpinConv}
                onArchiveRoom={handleArchiveRoom}
                onUnarchiveRoom={handleUnarchiveRoom}
                onArchiveConversation={handleHideConv}
                onUnarchiveConversation={handleUnhideConv}
                onExportChat={handleExportChat}
                onPollVote={handlePollVote}
                onViewScheduled={() => {
                  setScheduledFilter(
                    selectedId && selectedType
                      ? { type: selectedType === "room" ? "room" : "dm", id: selectedId }
                      : null
                  );
                  setShowScheduled(true);
                }}
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
            <ThirdPane selectedConv={selectedConversation} messageCount={messagesHook.messages.length} />
          </Suspense>
        )}
      </div>

      {showNewChat && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <NewChatModal
            allUsers={allUsers}
            onSelectUser={(id) => { setShowNewChat(false); handleSelectConv(id, "direct"); }}
            onSelectRoom={(id) => { setShowNewChat(false); handleSelectConv(id, "room"); }}
            onClose={() => setShowNewChat(false)}
          />
        </Suspense>
      )}

      {forwardMessage && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <ForwardModal
            message={forwardMessage}
            onForward={handleForwardToTarget}
            forwarding={false}
            onClose={() => setForwardMessage(null)}
          />
        </Suspense>
      )}

      {showStarred && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <StarredMessagesModal
            onSelectMessage={(msg) => {
              setShowStarred(false);
              handleSelectConv(msg.room_id || msg.receiver_id || msg.sender_id, msg.room_id ? "room" : "direct");
              setTargetMessageId(msg.id);
            }}
            onClose={() => setShowStarred(false)}
          />
        </Suspense>
      )}

      {showScheduled && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pulse"><div className="w-96 h-[80vh] max-h-[80vh] rounded-2xl bg-surface" /></div>}>
          <ScheduledMessagesModal
            filterConv={scheduledFilter}
            onSelectMessage={(msg) => {
              setShowScheduled(false);
              const convId = msg.room_id || msg.receiver_id;
              if (convId) handleSelectConv(convId, msg.room_id ? "room" : "direct");
            }}
            onClose={() => setShowScheduled(false)}
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
              handleSelectConv(conv.id, conv.type as "direct" | "room");
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
            remoteUserName={remoteUserName}
            safetyNumber={safetyNumber}
            verified={verified}
            loading={safetyLoading}
            onVerify={() => e2e.verifySafetyNumber(selectedId!)}
          />
        </Suspense>
      )}
    </div>
  );
}