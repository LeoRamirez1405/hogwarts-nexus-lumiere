"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, Message } from "@/lib/api";
import { useChatComposer } from "./hooks/useChatComposer";
import { useChatScroll } from "./hooks/useChatScroll";
import ChatHeader from "./components/ChatHeader";
import InChatSearchPanel from "./components/InChatSearchPanel";
import MembersPanel from "./components/MembersPanel";
import PinnedMessagesBar from "./components/PinnedMessagesBar";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";
import ChatMenu from "./components/ChatMenu";
import type { ChatPanelProps, ConvType, MuteDuration } from "./types";

export type { SelectedConv, ChatPanelProps } from "./types";

export default function ChatPanel(props: ChatPanelProps) {
  const {
    messages,
    selectedConv,
    onSend,
    onBack,
    showBack,
    onRefresh,
    roomMembers,
    onHideConversation,
    onLeaveRoom,
    hasMore,
    loadingOlder,
    onLoadOlder,
    firstUnreadId,
    unreadCount,
    pinnedMessages,
    onTogglePin,
    onEditMessage,
    onDeleteMessage,
    targetMessageId,
    typingUsers,
    onlineUsers,
    onPinConversation,
    onUnpinConversation,
    onArchiveRoom,
    onUnarchiveRoom,
    onExportChat,
    onToggleStar,
  } = props;

  const [showMenu, setShowMenu] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [inChatSearch, setInChatSearch] = useState("");
  const [inChatSearchResults, setInChatSearchResults] = useState<Message[]>([]);
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const { user } = useAuthStore();

  const {
    containerRef,
    dividerRef,
    scrollToBottom,
    handleScroll,
    showScrollBtn,
    newCount,
    snapToBottom,
  } = useChatScroll({
    messages,
    convId: selectedConv?.id,
    hasMore,
    loadingOlder,
    onLoadOlder,
    firstUnreadId,
    targetMessageId,
  });

  const composer = useChatComposer({
    selectedConv,
    onSend: useCallback(
      (data) => {
        snapToBottom();
        onSend(data);
      },
      [onSend, snapToBottom]
    ),
  });

  const isRoom = selectedConv?.type === "room";

  const handleEdit = useCallback(
    (message: Message) => {
      // TODO: Implement edit modal/inline edit
      const newBody = prompt("Editar mensaje:", message.body || "");
      if (newBody !== null && newBody !== message.body && newBody.trim() && onEditMessage) {
        onEditMessage(message.id, selectedConv?.id || "", newBody.trim());
      }
    },
    [onEditMessage, selectedConv?.id]
  );

  const handleDelete = useCallback(
    (message: Message) => {
      if (confirm("¿Eliminar este mensaje?") && onDeleteMessage) {
        onDeleteMessage(message.id, selectedConv?.id || "");
      }
    },
    [onDeleteMessage, selectedConv?.id]
  );

  // In-chat search
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!inChatSearch.trim()) {
        if (!cancelled) setInChatSearchResults([]);
        return;
      }
      if (!selectedConv?.id) return;
      try {
        const results = await api.searchRoomMessages(selectedConv.id, inChatSearch, 50);
        if (!cancelled) setInChatSearchResults(results);
      } catch (err) {
        console.error("In-chat search failed", err);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [inChatSearch, selectedConv?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutside =
        (!menuRef.current || !menuRef.current.contains(target)) &&
        (!moreButtonRef.current || !moreButtonRef.current.contains(target));
      if (isOutside) {
        setShowMenu(false);
        setShowMuteMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight-message");
    setTimeout(() => el.classList.remove("highlight-message"), 2000);
  };

  const toggleMenu = useCallback((rect: DOMRect) => {
    setShowMenu((prev) => {
      if (!prev) {
        setMenuPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      }
      return !prev;
    });
    setShowMuteMenu(false);
  }, []);

  const handleHideConversation = () => {
    if (!selectedConv) return;
    const convType = selectedConv.type === "room" ? "room" : "dm";
    if (onHideConversation) {
      onHideConversation(convType, selectedConv.id);
    }
    setShowMenu(false);
  };

  const handleLeaveRoom = () => {
    if (!selectedConv || selectedConv.type !== "room") return;
    if (!confirm("¿Seguro que quieres salir del grupo?")) return;
    if (onLeaveRoom) {
      onLeaveRoom(selectedConv.id);
    }
    setShowMenu(false);
  };

  const handleMuteConversation = async (duration: MuteDuration) => {
    if (!selectedConv) return;
    const convType = selectedConv.type === "room" ? "room" : "dm";
    try {
      await api.muteConversation(convType, selectedConv.id, duration);
      setShowMuteMenu(false);
      setShowMenu(false);
      onRefresh?.();
    } catch (err) {
      console.error("Mute failed", err);
    }
  };

  const handlePin = (convType: ConvType) => {
    if (!selectedConv) return;
    onPinConversation?.(convType, selectedConv.id);
  };

  const handleUnpin = (convType: ConvType) => {
    if (!selectedConv) return;
    onUnpinConversation?.(convType, selectedConv.id);
  };

  const handleArchive = () => {
    if (!selectedConv) return;
    onArchiveRoom?.(selectedConv.id);
  };

  const handleUnarchive = () => {
    if (!selectedConv) return;
    onUnarchiveRoom?.(selectedConv.id);
  };

  const handleExport = () => {
    if (!selectedConv) return;
    const convType = selectedConv.type === "room" ? "room" : "dm";
    onExportChat?.(convType, selectedConv.id, selectedConv.name);
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        selectedConv={selectedConv}
        onlineUsers={onlineUsers}
        showBack={showBack}
        onBack={onBack}
        showInChatSearch={showInChatSearch}
        onToggleSearch={() => setShowInChatSearch(!showInChatSearch)}
        moreButtonRef={moreButtonRef}
        onMoreClick={toggleMenu}
      />

      {showInChatSearch && (
        <InChatSearchPanel
          value={inChatSearch}
          onChange={setInChatSearch}
          results={inChatSearchResults}
          onSelectResult={(msg) => {
            setShowInChatSearch(false);
            scrollToMessage(msg.id);
          }}
          onClose={() => setShowInChatSearch(false)}
        />
      )}

      {showMembers && roomMembers && (
        <MembersPanel members={roomMembers} onClose={() => setShowMembers(false)} />
      )}

      <div className="relative flex-1 min-h-0">
        {pinnedMessages && pinnedMessages.length > 0 && (
          <PinnedMessagesBar
            pinnedMessages={pinnedMessages}
            showPinned={showPinned}
            onToggle={() => setShowPinned((s) => !s)}
            onSelectMessage={(pm) => scrollToMessage(pm.id)}
            onUnpin={onTogglePin}
          />
        )}

        <ChatMessages
          messages={messages}
          user={user}
          containerRef={containerRef}
          dividerRef={dividerRef}
          onScroll={handleScroll}
          firstUnreadId={firstUnreadId}
          unreadCount={unreadCount}
          loadingOlder={loadingOlder}
          hasMore={hasMore}
          isRoom={isRoom}
          roomMembers={roomMembers}
          typingUsers={typingUsers}
          showScrollBtn={showScrollBtn}
          newCount={newCount}
          onScrollToBottom={() => scrollToBottom(true)}
          onReply={composer.onReply}
          onRefresh={onRefresh}
          onScrollToMessage={scrollToMessage}
          onTogglePin={onTogglePin}
          onToggleStar={onToggleStar}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <ChatInput
        input={composer.input}
        replyingTo={composer.replyingTo}
        attachment={composer.attachment}
        uploading={composer.uploading}
        showStickers={composer.showStickers}
        stickerTab={composer.stickerTab}
        showPoll={composer.showPoll}
        mentionResults={composer.mentionResults}
        showMentionDropdown={composer.showMentionDropdown}
        voice={composer.voice}
        inputRef={composer.inputRef}
        fileInputRef={composer.fileInputRef}
        onInputChange={composer.handleInputChange}
        onTypingStop={composer.handleTypingStop}
        onSend={composer.handleSend}
        onCancelReply={composer.onCancelReply}
        onRemoveAttachment={composer.onRemoveAttachment}
        onToggleStickers={composer.onToggleStickers}
        onStickerTabChange={composer.onStickerTabChange}
        onSendSticker={composer.sendSticker}
        onTogglePoll={composer.onTogglePoll}
        onPollCreate={composer.handlePollCreate}
        onCancelPoll={composer.onCancelPoll}
        onFileSelect={composer.handleFileSelect}
        onStartRecording={composer.voice.start}
        onStopRecording={composer.handleStopRecording}
        onCancelRecording={composer.handleCancelRecording}
        onSendVoice={composer.handleSendVoice}
        onTranscribeVoice={composer.handleTranscribeVoice}
        onSelectMention={composer.handleSelectMention}
        onDismissMentions={composer.onDismissMentions}
        disappearAt={composer.disappearAt}
        onDisappearChange={composer.onDisappearChange}
      />

      <ChatMenu
        show={showMenu}
        position={menuPosition}
        menuRef={menuRef}
        selectedConv={selectedConv}
        showMuteMenu={showMuteMenu}
        onToggleMuteMenu={() => setShowMuteMenu(!showMuteMenu)}
        onMute={handleMuteConversation}
        onClose={() => setShowMenu(false)}
        onShowMembers={() => {
          setShowMembers(true);
          setShowMenu(false);
        }}
        onHideConversation={handleHideConversation}
        onLeaveRoom={handleLeaveRoom}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onExport={handleExport}
      />
    </div>
  );
}
