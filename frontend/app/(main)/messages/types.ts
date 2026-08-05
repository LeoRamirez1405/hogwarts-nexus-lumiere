"use client";

import type { Message, Conversation, User, MessageSendData, ChatRoomMemberResponse } from "@/lib/api";
import type { OutboxMessage } from "@/hooks/useIndexedDB";

export type { Message, Conversation, User, MessageSendData, ChatRoomMemberResponse, OutboxMessage };

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onlineUsers: Map<string, boolean>;
  onClick: () => void;
  currentUserId?: string;
}

export interface ChatPanelProps {
  messages: Message[];
  selectedConv: Conversation;
  onSend: (data: MessageSendData) => Promise<void>;
  onBack: () => void;
  showBack: boolean;
  roomMembers?: ChatRoomMemberResponse[];
  onHideConversation: (convType: "dm" | "room", convId: string) => Promise<void>;
  onLeaveRoom: (roomId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => Promise<void>;
  firstUnreadId: string | null;
  unreadCount: number;
  pinnedMessages: Message[];
  onTogglePin: (m: Message) => Promise<void>;
  onEditMessage: (messageId: string, _convId: string, body: string) => Promise<void>;
  onDeleteMessage: (messageId: string, _convId: string) => Promise<void>;
  onForwardMessage: (message: Message) => void;
  targetMessageId: string | null;
  typingUsers: Map<string, string>;
  onlineUsers: Map<string, boolean>;
  onToggleStar: (message: Message) => Promise<void>;
  onShowMediaGallery: () => void;
  e2eEncrypted: boolean;
  e2eVerified: boolean;
  onE2EClick?: () => void;
  isPinned: boolean;
  isArchived: boolean;
  onMuteConversation: (convType: "dm" | "room", convId: string, duration: MuteDuration) => Promise<void>;
  onPinConversation: (convType: "dm" | "room", convId: string) => Promise<void>;
  onUnpinConversation: (convType: "dm" | "room", convId: string) => Promise<void>;
  onArchiveRoom: (roomId: string) => Promise<void>;
  onUnarchiveRoom: (roomId: string) => Promise<void>;
  onArchiveConversation: (convType: "dm" | "room", convId: string) => Promise<void>;
  onUnarchiveConversation: (convType: "dm" | "room", convId: string) => Promise<void>;
  onExportChat: (convType: "dm" | "room", convId: string, convName: string) => Promise<void>;
  onPollVote: (messageId: string, updatedPoll: NonNullable<Message["poll"]>) => void;
}

export interface ThirdPaneProps {
  selectedConv: Conversation;
  messageCount: number;
}

export interface NewChatModalProps {
  allUsers: User[];
  onSelectUser: (id: string) => void;
  onSelectRoom: (id: string) => void;
  onClose: () => void;
}

export interface ForwardModalProps {
  message: Message;
  onForward: (message: Message, targetId: string, targetType: "dm" | "room") => Promise<void>;
  forwarding: boolean;
  onClose: () => void;
}

export interface StarredMessagesModalProps {
  onSelectMessage: (msg: Message) => void;
  onClose: () => void;
}

export interface MediaGalleryModalProps {
  convId: string;
  convType: "room" | "dm";
  convName: string;
  onClose: () => void;
}

export interface ArchivedConversationsModalProps {
  onClose: () => void;
  onSelectConversation: (conv: Conversation) => void;
}

export interface GlobalSearchPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: Message[];
  onSelectResult: (msg: Message) => void;
}

export interface SafetyNumberDialogProps {
  open: boolean;
  onClose: () => void;
  remoteUserId: string;
  remoteUserName: string;
  safetyNumber: string | null;
  verified: boolean;
  loading: boolean;
  onVerify: () => Promise<void>;
}

export interface MobileToolbarProps {
  selectedConv: Conversation | null;
  typingUsers: Map<string, string>;
  onlineUsers: Map<string, boolean>;
  onBack: () => void;
}

// Alias for backward compatibility
export type SelectedConv = Conversation;
export type ConvType = "direct" | "room";
export type ConvApiType = "dm" | "room";
export type MuteDuration = "1h" | "8h" | "24h" | "7d" | "forever" | "off";

export interface AttachmentPreview {
  url: string;
  type: string;
  name: string;
}

export type SelectedConvType = "direct" | "room";

export function toApiConvType(type: ConvType): ConvApiType {
  return type === "direct" ? "dm" : "room";
}

export const PAGE_SIZE = 50;

export function byCreatedAsc(a: Message, b: Message): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}