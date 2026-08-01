import type { User, UserSearchResult } from "./users";

export interface MessageMetadata {
  transcription?: string;
  size?: number;
  duration?: number;
  post?: SharedPostMeta;
  link_preview?: LinkPreviewResponse;
  [key: string]: unknown;
}

export type MessageKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "poll"
  | "voice"
  | "post";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string;
  room_id?: string;
  reply_to_id?: string;
  forwarded_from_id?: string;
  forwarded?: boolean;
  starred?: boolean;
  disappear_at?: string;
  scheduled_at?: string;
  kind: MessageKind;
  body?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  metadata?: MessageMetadata;
  read: boolean;
  pinned?: boolean;
  edited?: boolean;
  edited_at?: string;
  created_at: string;
  sender?: User;
  receiver?: User;
  room?: ChatRoomBrief;
  poll?: PollResponse;
  reply_to?: Message;
  reactions?: MessageReaction[];
}

export interface MessagePage {
  messages: Message[];
  has_more: boolean;
  first_unread_id?: string | null;
  unread_count: number;
}

export interface Conversation {
  type: "direct" | "room";
  id: string;
  name: string;
  avatar_url?: string;
  subtitle?: string;
  email?: string;
  house?: string;
  zerines?: number;
  last_message?: Message;
  unread_count: number;
  is_muted?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  last_active_at?: string;
  online_count?: number;
}

export interface ChatRoomMemberResponse {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  pending: boolean;
  user?: User;
}

export interface ChatRoomBrief {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  closed: boolean;
  join_approval: boolean;
  created_by: string;
  created_at: string;
  member_count: number;
}

export interface ChatRoomResponse {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  closed: boolean;
  join_approval: boolean;
  created_by: string;
  created_at: string;
  members: ChatRoomMemberResponse[];
}

export interface CreateRoomData {
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  member_ids: string[];
}

export interface UpdateRoomData {
  name?: string;
  description?: string;
  avatar_url?: string;
}

export interface MessageSendData {
  receiver_id?: string;
  room_id?: string;
  reply_to_id?: string;
  body?: string;
  kind?: MessageKind;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  metadata?: MessageMetadata;
  disappear_at?: string;
  poll?: {
    question: string;
    options: string[];
    multi_choice: boolean;
  };
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface PollOptionResponse {
  id: string;
  label: string;
  option_index: number;
  votes_count: number;
  voted_by_me: boolean;
}

export interface PollResponse {
  id: string;
  question: string;
  multi_choice: boolean;
  total_votes: number;
  options: PollOptionResponse[];
  my_option_ids: string[];
}

export interface SharedPostMeta {
  id: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  body: string;
  image_url?: string;
  created_at?: string;
}

export interface RoomInviteCreate {
  expires_at?: string;
  max_uses?: number;
}

export interface RoomInviteResponse {
  id: string;
  room_id: string;
  token: string;
  created_by: string;
  expires_at?: string;
  max_uses?: number;
  uses: number;
  revoked: boolean;
  created_at: string;
}

export interface RoomInviteInfoResponse {
  room_id: string;
  room_name: string;
  room_avatar_url?: string;
  member_count: number;
  requires_approval: boolean;
  expired: boolean;
  revoked: boolean;
  uses_exhausted: boolean;
}

export interface RoleUpdateRequest {
  role: "admin" | "member";
}

export interface PendingMemberAction {
  user_id: string;
  action: "approve" | "reject";
}

export interface LinkPreviewRequest {
  url: string;
}

export interface LinkPreviewResponse {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
}

export type { UserSearchResult };
