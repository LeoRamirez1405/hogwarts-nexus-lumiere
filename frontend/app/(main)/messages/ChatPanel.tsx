"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, Message, ChatRoomMemberResponse } from "@/lib/api";
import { useChatComposer } from "./hooks/useChatComposer";
import { useChatScroll } from "./hooks/useChatScroll";
import ChatHeader from "./components/ChatHeader";
import InChatSearchPanel from "./components/InChatSearchPanel";
import MembersPanel from "./components/MembersPanel";
import PinnedMessagesBar from "./components/PinnedMessagesBar";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";
import ChatMenu from "./components/ChatMenu";
import EventList from "./components/EventList";
import VoiceChannelPanel from "./components/VoiceChannelPanel";
import ActiveVoiceBar from "./components/ActiveVoiceBar";
import { EditRoomModal } from "./components/EditRoomModal";
import { useVoiceChannel } from "./hooks/useVoiceChannel";
import { useActiveVoiceChannel } from "./hooks/useActiveVoiceChannel";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import type { ChatPanelProps, ConvType, MuteDuration } from "./types";
import { toApiConvType } from "./types";

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
    onForwardMessage,
    targetMessageId,
    typingUsers,
    onlineUsers,
    isPinned,
    isArchived,
    onPinConversation,
    onUnpinConversation,
    onArchiveRoom,
    onUnarchiveRoom,
    onArchiveConversation,
    onUnarchiveConversation,
    onExportChat,
    onToggleStar,
    onShowMediaGallery,
    e2eEncrypted,
    e2eVerified,
    onE2EClick,
  } = props;

  const [showMenu, setShowMenu] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [inChatSearch, setInChatSearch] = useState("");
  const [inChatSearchResults, setInChatSearchResults] = useState<Message[]>([]);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showVoiceChannels, setShowVoiceChannels] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const eventsEnabled = useFeatureFlag("events.enabled");

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
  const currentUserId = user?.id;
  const isAdmin = (isRoom && roomMembers?.some(
    (m: ChatRoomMemberResponse) => m.user_id === currentUserId && m.role === "admin" && !m.pending
  )) ?? false;
  // Privileged room actions (change roles, approve members, start/delete voice
  // channels) are reserved for site admins only — there is no "room admin" tier.
  const isGlobalAdmin = user?.role === "admin";

  const voice = useVoiceChannel();
  const { active: activeVoice, refresh: refreshActiveVoice } = useActiveVoiceChannel(
    selectedConv?.id,
    isRoom
  );

  const handleJoinActiveVoice = useCallback(async () => {
    if (!activeVoice || !selectedConv) return;
    try {
      await voice.joinChannel(activeVoice.id, selectedConv.id);
      setShowVoiceChannels(true);
      refreshActiveVoice();
    } catch {
      // useVoiceChannel already logs; surface nothing extra here.
    }
  }, [activeVoice, selectedConv, voice, refreshActiveVoice]);

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

  const handleForward = useCallback(
    (message: Message) => {
      if (onForwardMessage) {
        onForwardMessage(message);
      }
    },
    [onForwardMessage]
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
        const results =
          selectedConv.type === "room"
            ? await api.searchRoomMessages(selectedConv.id, inChatSearch, 50)
            : await api.searchDmMessages(selectedConv.id, inChatSearch, 50);
        if (!cancelled) setInChatSearchResults(results);
      } catch (err) {
        console.error("In-chat search failed", err);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [inChatSearch, selectedConv?.id, selectedConv?.type]);

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
    const convType = selectedConv.type === "room" ? "room" : "direct";
    try {
      await api.muteConversation(toApiConvType(convType), selectedConv.id, duration);
      setShowMuteMenu(false);
      setShowMenu(false);
      onRefresh?.();
    } catch (err) {
      console.error("Mute failed", err);
    }
  };

  const handlePin = (convType: ConvType) => {
    if (!selectedConv) return;
    onPinConversation?.(toApiConvType(convType), selectedConv.id);
  };

  const handleUnpin = (convType: ConvType) => {
    if (!selectedConv) return;
    onUnpinConversation?.(toApiConvType(convType), selectedConv.id);
  };

  const handleArchive = () => {
    if (!selectedConv) return;
    onArchiveRoom?.(selectedConv.id);
  };

  const handleUnarchive = () => {
    if (!selectedConv) return;
    onUnarchiveRoom?.(selectedConv.id);
  };

  const handleArchiveDM = () => {
    if (!selectedConv || selectedConv.type !== "direct") return;
    onArchiveConversation?.("dm", selectedConv.id);
    setShowMenu(false);
  };

  const handleUnarchiveDM = () => {
    if (!selectedConv || selectedConv.type !== "direct") return;
    onUnarchiveConversation?.("dm", selectedConv.id);
    setShowMenu(false);
  };

  const handleExport = () => {
    if (!selectedConv) return;
    const convType = selectedConv.type === "room" ? "room" : "dm";
    onExportChat?.(convType, selectedConv.id, selectedConv.name);
  };

  const handleShowVoiceChannels = () => {
    setShowVoiceChannels(true);
    setShowMenu(false);
  };

  const handleShowEditRoom = () => {
    setShowEditRoom(true);
    setShowMenu(false);
  };

  const handleShowInvite = async () => {
    setShowMenu(false);
    try {
      const invite = await api.createRoomInvite(selectedConv?.id || "", {});
      const link = `${window.location.origin}/messages/invite/${invite.token}`;
      await navigator.clipboard.writeText(link);
      // Show a toast or alert
      alert(`¡Enlace copiado!\n${link}`);
    } catch (error) {
      console.error('Failed to create invite link:', error);
      alert("Error al crear el enlace");
    }
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
        e2eEncrypted={e2eEncrypted}
        e2eVerified={e2eVerified}
        onE2EClick={onE2EClick}
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

      {showMembers && roomMembers && selectedConv && (
        <MembersPanel
          members={roomMembers}
          roomId={selectedConv.id}
          currentUserId={currentUserId ?? ""}
          isAdmin={isGlobalAdmin}
          onClose={() => setShowMembers(false)}
          onRefresh={() => onRefresh?.()}
        />
      )}

      {showEvents && isRoom && selectedConv && eventsEnabled && (
        <div className="border-b border-outline-variant/20 max-h-[50vh] overflow-y-auto">
          <div className="sticky top-0 z-10 bg-surface-container-low px-4 py-2 flex items-center justify-between border-b border-outline-variant/10">
            <span className="font-display text-headline-sm text-on-surface">Eventos</span>
            <button
              onClick={() => setShowEvents(false)}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>
          </div>
          <div className="px-4 py-3">
            <EventList
              roomId={selectedConv.id}
              currentUserId={currentUserId ?? ""}
              isAdminOrMod={isAdmin ?? false}
              isVisible={true}
            />
          </div>
        </div>
      )}

      {showVoiceChannels && isRoom && selectedConv && (
        <VoiceChannelPanel
          roomId={selectedConv.id}
          isAdmin={isGlobalAdmin}
          activeChannelId={voice.channelId}
          isMuted={voice.isMuted}
          isDeafened={voice.isDeafened}
          isVideoEnabled={voice.isVideoEnabled}
          onJoin={(channelId) => voice.joinChannel(channelId, selectedConv.id)}
          onLeave={voice.leaveChannel}
          onToggleMute={voice.toggleMute}
          onToggleDeafen={voice.toggleDeafen}
          onToggleVideo={voice.toggleVideo}
          onClose={() => setShowVoiceChannels(false)}
        />
      )}

      {showEditRoom && selectedConv && (
        <EditRoomModal
          roomId={selectedConv.id}
          roomName={selectedConv.name}
          roomAvatar={selectedConv.avatar_url}
          roomDescription={selectedConv.subtitle}
          isOpen={showEditRoom}
          onClose={() => setShowEditRoom(false)}
          onRefresh={onRefresh ?? (() => {})}
        />
      )}

      <div className="relative flex-1 min-h-0">
        {((pinnedMessages && pinnedMessages.length > 0) || (isRoom && activeVoice)) && (
          <div className="absolute top-0 left-0 right-0 z-20">
            {pinnedMessages && pinnedMessages.length > 0 && (
              <PinnedMessagesBar
                pinnedMessages={pinnedMessages}
                showPinned={showPinned}
                onToggle={() => setShowPinned((s) => !s)}
                onSelectMessage={(pm) => scrollToMessage(pm.id)}
                onUnpin={onTogglePin}
              />
            )}
            {isRoom && activeVoice && (
              <ActiveVoiceBar
                channel={activeVoice}
                isJoined={voice.channelId === activeVoice.id}
                onJoin={handleJoinActiveVoice}
                onOpenPanel={() => setShowVoiceChannels(true)}
              />
            )}
          </div>
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
          replyingToId={composer.replyingTo?.id ?? null}
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
          onForward={handleForward}
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
        video={composer.video}
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
        onStartVideoRecording={composer.handleStartVideoRecording}
        onStopVideoRecording={composer.handleStopVideoRecording}
        onCancelVideoRecording={composer.handleCancelVideoRecording}
        onSendVideo={composer.handleSendVideo}
        onSelectMention={composer.handleSelectMention}
        onDismissMentions={composer.onDismissMentions}
        disappearAt={composer.disappearAt}
        onDisappearChange={composer.onDisappearChange}
        scheduleAt={composer.scheduleAt}
        onScheduleChange={composer.onScheduleChange}
      />

      <ChatMenu
        show={showMenu}
        position={menuPosition}
        menuRef={menuRef}
        selectedConv={selectedConv}
        showMuteMenu={showMuteMenu}
        isPinned={isPinned ?? false}
        isArchived={isArchived ?? false}
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
        onArchive={isRoom ? handleArchive : handleArchiveDM}
        onUnarchive={isRoom ? handleUnarchive : handleUnarchiveDM}
        onExport={handleExport}
        onShowMediaGallery={onShowMediaGallery ?? (() => {})}
        onShowEvents={() => {
          setShowEvents(true);
          setShowMenu(false);
        }}
        onShowVoiceChannels={handleShowVoiceChannels}
        onShowEditRoom={handleShowEditRoom}
        onShowInvite={handleShowInvite}
        isRoom={isRoom}
        eventsEnabled={eventsEnabled}
        isAdmin={isAdmin}
      />
    </div>
  );
}
