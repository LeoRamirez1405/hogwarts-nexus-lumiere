import type { Message, MessageSendData, ChatRoomMemberResponse } from "@/lib/api";

// --- WebSocket payloads ---------------------------------------------------
export interface WSNewMessage {
  c: string;
  m: Message;
}

export interface WSTyping {
  c: string;
  u: string;
}

export interface WSPresence {
  u: string;
  s: "online" | "offline";
}

export interface WSReadReceipt {
  c: string;
  m: string;
  u: string;
  ts: number;
}

export interface WSReactionUpdate {
  c: string;
  m: string;
  r: Message["reactions"];
}

export interface WSDelete {
  c: string;
  m: string;
}

export interface WSEdit {
  c: string;
  m: Message;
}

// --- Chat primitives ------------------------------------------------------
export type ConvType = "dm" | "room";
export type SelectedConvType = "direct" | "room";
export type MuteDuration = "8h" | "24h" | "forever" | "off";

export const PAGE_SIZE = 30;

export const byCreatedAsc = (a: Message, b: Message) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

// --- ChatPanel props ------------------------------------------------------
export interface SelectedConv {
  id: string;
  name: string;
  avatar_url?: string;
  type?: SelectedConvType;
  created_by?: string;
  last_active_at?: string;
  online_count?: number;
  subtitle?: string;
}

export interface AttachmentPreview {
  url: string;
  type: string;
  name: string;
}

export interface ChatPanelProps {
  messages: Message[];
  selectedConv: SelectedConv | null;
  onSend: (data: MessageSendData) => void;
  onBack: () => void;
  showBack: boolean;
  onRefresh?: () => void;
  roomMembers?: ChatRoomMemberResponse[];
  onHideConversation?: (convType: ConvType, convId: string) => void;
  onLeaveRoom?: (roomId: string) => void;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string | null;
  unreadCount?: number;
  pinnedMessages?: Message[];
  onTogglePin?: (message: Message) => void;
  onEditMessage?: (messageId: string, conversationId: string, body: string) => void;
  onDeleteMessage?: (messageId: string, conversationId: string) => void;
  onForwardMessage?: (message: Message, targetId: string, targetType: ConvType) => void;
  targetMessageId?: string | null;
  typingUsers?: Map<string, string>;
  onlineUsers?: Map<string, boolean>;
  onPinConversation?: (convType: ConvType, convId: string) => void;
  onUnpinConversation?: (convType: ConvType, convId: string) => void;
  onArchiveRoom?: (roomId: string) => void;
  onUnarchiveRoom?: (roomId: string) => void;
  onArchiveConversation?: (convType: ConvType, convId: string) => void;
  onUnarchiveConversation?: (convType: ConvType, convId: string) => void;
  onExportChat?: (convType: ConvType, convId: string, convName: string) => void;
  onToggleStar?: (msg: Message) => void;
  onShowMediaGallery?: () => void;
  onShowEvents?: () => void;
  e2eEncrypted?: boolean;
  e2eVerified?: boolean;
  onE2EClick?: () => void;
}
