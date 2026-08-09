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
import EventLiveBanner from "./components/EventLiveBanner";
import EventCensusModal from "./components/EventCensusModal";
import EventLiveWelcome from "./components/EventLiveWelcome";
import EventModal from "./components/EventModal";
import ActiveVoiceBar from "./components/ActiveVoiceBar";
import { EditRoomModal } from "./components/EditRoomModal";
import { useVoiceChannel } from "./hooks/useVoiceChannel";
import { useActiveVoiceChannel } from "./hooks/useActiveVoiceChannel";
import { useRoomLiveEvent } from "./hooks/useRoomLiveEvent";
import { eventsApi } from "@/lib/api/eventsApi";
import { isApiError } from "@/lib/api/core/errors";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import type { ChatPanelProps, ConvType, MuteDuration } from "./types";
import { toApiConvType } from "./types";
import type { Event as RoomEvent, EventCreate, EventUpdate, RSVPStatus, ReminderTime } from "@/lib/api/events";

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
    membersLoading,
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
    onMuteConversation,
    onPinConversation,
    onUnpinConversation,
    onArchiveRoom,
    onUnarchiveRoom,
    onArchiveConversation,
    onUnarchiveConversation,
    onExportChat,
    onPollVote,
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
    onEditMessage: useCallback(
      (messageId: string, body: string) => {
        if (onEditMessage) onEditMessage(messageId, selectedConv?.id || "", body);
      },
      [onEditMessage, selectedConv?.id]
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
      refreshActiveVoice();
    } catch {
      // useVoiceChannel already logs; surface nothing extra here.
    }
  }, [activeVoice, selectedConv, voice, refreshActiveVoice]);

  // Live event (single per room): drives the banner, census, and the one-shot
  // welcome animation shown the first time the user is here while it runs.
  const { liveEvent, refresh: refreshLiveEvent } = useRoomLiveEvent(
    isRoom ? selectedConv?.id : undefined,
    eventsEnabled && isRoom
  );
  const [showCensus, setShowCensus] = useState(false);
  const [welcomeTitle, setWelcomeTitle] = useState<string | null>(null);
  const seenCheckedRef = useRef<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RoomEvent | null>(null);
  const [eventModalLoading, setEventModalLoading] = useState(false);
  const [eventModalError, setEventModalError] = useState<string | null>(null);

  const handleJoinEventVoice = useCallback(
    async (channelId: string) => {
      if (!selectedConv) return;
      try {
        await voice.joinChannel(channelId, selectedConv.id);
      } catch {
        // useVoiceChannel already logs; surface nothing extra here.
      }
    },
    [selectedConv, voice]
  );

  // Banner-side handlers: live event mutations refresh the banner via the
  // useRoomLiveEvent poller's refresh (and the WS push is also routed there).
  const handleBannerRsvp = useCallback(
    async (eventId: string, status: RSVPStatus) => {
      try {
        await eventsApi.rsvp(eventId, status);
        await refreshLiveEvent();
      } catch (err) {
        console.error("Error RSVP:", err);
      }
    },
    [refreshLiveEvent]
  );

  const handleBannerRemoveRsvp = useCallback(
    async (eventId: string) => {
      try {
        await eventsApi.removeRsvp(eventId);
        await refreshLiveEvent();
      } catch (err) {
        console.error("Error removing RSVP:", err);
      }
    },
    [refreshLiveEvent]
  );

  const handleBannerSetReminder = useCallback(
    async (eventId: string, reminder: ReminderTime) => {
      try {
        await eventsApi.setReminder(eventId, reminder);
        await refreshLiveEvent();
      } catch (err) {
        console.error("Error setting reminder:", err);
      }
    },
    [refreshLiveEvent]
  );

  const openEventEditModal = useCallback((event: RoomEvent) => {
    setEditingEvent(event);
    setEventModalError(null);
    setShowEventModal(true);
  }, []);

  const handleEventSubmit = useCallback(
    async (data: EventCreate | EventUpdate) => {
      if (!selectedConv) return;
      setEventModalLoading(true);
      setEventModalError(null);
      try {
        if (editingEvent) {
          await eventsApi.update(editingEvent.id, data as EventUpdate);
        } else {
          await eventsApi.create({ ...(data as EventCreate), room_id: selectedConv.id });
        }
        setShowEventModal(false);
        setEditingEvent(null);
        await refreshLiveEvent();
      } catch (err) {
        console.error("Error saving event:", err);
        // Surface a readable message to the user (the modal renders this box).
        const msg = isApiError(err)
          ? err.detail
          : err instanceof Error
            ? err.message
            : "No se pudo guardar el evento. Revisa los campos e inténtalo de nuevo.";
        setEventModalError(msg);
      } finally {
        setEventModalLoading(false);
      }
    },
    [editingEvent, selectedConv, refreshLiveEvent]
  );

  const handleBannerDelete = useCallback(
    async (eventId: string) => {
      try {
        await eventsApi.delete(eventId);
        await refreshLiveEvent();
      } catch (err) {
        console.error("Error deleting event:", err);
      }
    },
    [refreshLiveEvent]
  );

  // Ask the backend (atomically) whether this is the first time the user sees
  // this in-progress event; play the animation only then.
  useEffect(() => {
    if (!liveEvent || !liveEvent.in_progress) return;
    if (seenCheckedRef.current === liveEvent.id) return;
    seenCheckedRef.current = liveEvent.id;
    let cancelled = false;
    eventsApi
      .markSeen(liveEvent.id)
      .then((r) => {
        if (!cancelled && r.first_time) setWelcomeTitle(liveEvent.title);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [liveEvent]);

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
    await onMuteConversation?.(toApiConvType(convType), selectedConv.id, duration);
    setShowMuteMenu(false);
    setShowMenu(false);
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

  const handleShowVoiceChannels = async () => {
    if (!selectedConv) {
      setShowMenu(false);
      return;
    }
    // Toggle based on the polled "active" channel — NOT on the local joined
    // state. The local `state.channelId` only fills when the admin has joined,
    // so relying on it would make "Cerrar" silently create a duplicate (the
    // backend 400s and nothing visible happens). Using `activeVoice` makes
    // the action work whether the admin is joined or just viewing the bar.
    try {
      if (activeVoice) {
        await voice.deleteChannel(activeVoice.id);
      } else {
        await voice.createChannel(selectedConv.id, "Chat de voz");
      }
      refreshActiveVoice();
    } catch (err) {
      console.error("Failed to toggle voice channel:", err);
    }
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
          membersLoading={membersLoading}
          roomId={selectedConv.id}
          currentUserId={currentUserId ?? ""}
          isAdmin={isGlobalAdmin}
          onClose={() => setShowMembers(false)}
          onRefresh={() => onRefresh?.()}
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
        {((pinnedMessages && pinnedMessages.length > 0) || (isRoom && activeVoice) || (isRoom && liveEvent)) && (
          <div className="absolute top-0 left-0 right-0 z-20">
            {isRoom && liveEvent && (
              <EventLiveBanner
                event={liveEvent}
                isAdminOrMod={isAdmin ?? false}
                onRsvp={handleBannerRsvp}
                onRemoveRsvp={handleBannerRemoveRsvp}
                onSetReminder={handleBannerSetReminder}
                onEdit={openEventEditModal}
                onDelete={handleBannerDelete}
                onOpenCensus={() => setShowCensus(true)}
                onJoinVoice={handleJoinEventVoice}
              />
            )}
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
                isAdmin={isGlobalAdmin}
                onJoin={handleJoinActiveVoice}
                onToggleMute={voice.toggleMute}
                onLeave={voice.leaveChannel}
                onCloseChannel={async () => {
                  if (!selectedConv || !activeVoice) return;
                  try {
                    await voice.deleteChannel(activeVoice.id);
                    refreshActiveVoice();
                  } catch (err) {
                    console.error("Failed to close voice channel:", err);
                  }
                }}
                isMuted={voice.isMuted}
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
          onEdit={composer.startEditMessage}
          onDelete={handleDelete}
          onForward={handleForward}
          onPollVote={onPollVote}
        />
      </div>

      <ChatInput
        input={composer.input}
        replyingTo={composer.replyingTo}
        editingMessage={composer.editingMessage}
        onCancelEdit={composer.cancelEdit}
        attachment={composer.attachment}
        uploading={composer.uploading}
        showStickers={composer.showStickers}
        stickerTab={composer.stickerTab}
        showPoll={composer.showPoll}
        mentionResults={composer.mentionResults}
        mentionOpen={composer.mentionOpen}
        mentionActiveIndex={composer.mentionActiveIndex}
        onMentionHover={composer.onMentionHover}
        onMentionMove={composer.onMentionMove}
        onMentionConfirm={composer.onMentionConfirm}
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

      {liveEvent && (
        <EventCensusModal
          eventId={liveEvent.id}
          eventTitle={liveEvent.title}
          open={showCensus}
          onClose={() => setShowCensus(false)}
        />
      )}

      <EventLiveWelcome
        title={welcomeTitle}
        onDone={() => setWelcomeTitle(null)}
        onOpen={() => setShowCensus(true)}
      />

      {/* Event create/edit modal — launched from the chat menu or the banner's "..." menu */}
      {selectedConv && (
        <EventModal
          isOpen={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
            setEventModalError(null);
          }}
          onSubmit={handleEventSubmit}
          initialData={editingEvent}
          roomId={selectedConv.id}
          isLoading={eventModalLoading}
          canCreateVoiceChannel={true}
          serverError={eventModalError}
        />
      )}

      <ChatMenu
        show={showMenu}
        position={menuPosition}
        menuRef={menuRef}
        selectedConv={selectedConv}
        showMuteMenu={showMuteMenu}
        isPinned={isPinned ?? false}
        isArchived={isArchived ?? false}
        isMuted={!!selectedConv?.is_muted}
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
          // "Crear evento" from the chat menu — opens the modal directly in
          // create mode (no panel). Live event banner above the chat handles
          // all read-side interactions (RSVP, edit, delete) once it exists.
          setEditingEvent(null);
          setEventModalError(null);
          setShowEventModal(true);
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
