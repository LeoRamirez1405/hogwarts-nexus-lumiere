import { request, buildQuery } from "../core";
import type { PaginationParams, Page } from "../core";
import type { User, UserSearchResult } from "./users";

export interface MessageMetadata {
  transcription?: string;
  size?: number;
  duration?: number;
  post?: SharedPostMeta;
  [key: string]: unknown;
}

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
  kind:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "poll"
    | "voice"
    | "post";
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
  user?: User;
}

export interface ChatRoomBrief {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  closed: boolean;
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
  kind?:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "poll"
    | "voice"
    | "post";
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  metadata?: MessageMetadata;
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

export const messagesApi = {
  getConversations: () =>
    request<Conversation[]>("/messages/conversations"),

  getMessages: (userId: string, limit?: number, before?: string) =>
    request<MessagePage>(
      `/messages/${userId}${buildQuery({ limit, before })}`
    ),

  sendMessage: (data: MessageSendData) =>
    request<Message>("/messages/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getRooms: (all?: boolean, pagination?: PaginationParams) =>
    request<Page<ChatRoomBrief>>(
      `/messages/rooms${buildQuery({
        all: all ? "true" : undefined,
        ...(pagination ?? {}),
      })}`
    ),

  getRoom: (roomId: string) =>
    request<ChatRoomResponse>(`/messages/rooms/${roomId}`),

  getRoomMessages: (roomId: string, limit?: number, before?: string) =>
    request<MessagePage>(
      `/messages/rooms/${roomId}/messages${buildQuery({ limit, before })}`
    ),

  pinMessage: (messageId: string) =>
    request<Message>(`/messages/${messageId}/pin`, { method: "PUT" }),

  getRoomPinned: (roomId: string) =>
    request<Message[]>(`/messages/rooms/${roomId}/pinned`),

  getDmPinned: (userId: string) =>
    request<Message[]>(`/messages/dm/${userId}/pinned`),

  sendRoomMessage: (roomId: string, data: MessageSendData) =>
    request<Message>(`/messages/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createRoom: (data: CreateRoomData) =>
    request<ChatRoomResponse>("/messages/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRoom: (roomId: string, data: UpdateRoomData) =>
    request<ChatRoomResponse>(`/messages/rooms/${roomId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteRoom: (roomId: string) =>
    request<void>(`/messages/rooms/${roomId}`, { method: "DELETE" }),

  addRoomMember: (roomId: string, userId: string, role?: string) =>
    request<ChatRoomMemberResponse>(
      `/messages/rooms/${roomId}/members?user_id=${userId}${role ? `&role=${role}` : ""}`,
      { method: "POST" }
    ),

  addRoomMembersBatch: (
    roomId: string,
    userIds: string[],
    role?: string
  ) =>
    request<ChatRoomMemberResponse[]>(
      `/messages/rooms/${roomId}/members/batch${role ? `?role=${role}` : ""}`,
      { method: "POST", body: JSON.stringify(userIds) }
    ),

  removeRoomMember: (roomId: string, userId: string) =>
    request<void>(`/messages/rooms/${roomId}/members/${userId}`, {
      method: "DELETE",
    }),

  votePoll: (messageId: string, optionIds: string[]) =>
    request<{ ok: boolean }>(`/messages/${messageId}/poll/vote`, {
      method: "POST",
      body: JSON.stringify({ option_ids: optionIds }),
    }),

  removePollVote: (messageId: string, optionId: string) =>
    request<{ ok: boolean }>(
      `/messages/${messageId}/poll/vote?option_id=${optionId}`,
      { method: "DELETE" }
    ),

  addReaction: (messageId: string, emoji: string) =>
    request<MessageReaction>(`/messages/${messageId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),

  removeReaction: (messageId: string, emoji: string) =>
    request<void>(
      `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: "DELETE" }
    ),

  editMessage: (messageId: string, body: string) =>
    request<Message>(`/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }),

  deleteMessage: (messageId: string) =>
    request<void>(`/messages/${messageId}`, { method: "DELETE" }),

  toggleRoomClosed: (roomId: string) =>
    request<ChatRoomResponse>(
      `/messages/rooms/${roomId}/toggle-close`,
      { method: "PUT" }
    ),

  hideConversation: (convType: "dm" | "room", convId: string) =>
    request<{ ok: boolean }>(
      `/messages/conversations/${convType}/${convId}/hide`,
      { method: "POST" }
    ),

  unhideConversation: (convType: "dm" | "room", convId: string) =>
    request<{ ok: boolean }>(
      `/messages/conversations/${convType}/${convId}/hide`,
      { method: "DELETE" }
    ),

  leaveRoom: (roomId: string) =>
    request<{ ok: boolean; room_deleted?: boolean }>(
      `/messages/rooms/${roomId}/leave`,
      { method: "DELETE" }
    ),

  muteRoom: (
    roomId: string,
    duration: "8h" | "24h" | "forever" | "off"
  ) =>
    request<{ ok: boolean; muted_until: string | null }>(
      `/messages/rooms/${roomId}/mute`,
      { method: "PUT", body: JSON.stringify({ duration }) }
    ),

  muteConversation: (
    convType: "dm" | "room",
    convId: string,
    duration: "8h" | "24h" | "forever" | "off"
  ) =>
    request<{ ok: boolean; muted_until: string | null }>(
      `/messages/conversations/${convType}/${convId}/mute`,
      { method: "PUT", body: JSON.stringify({ duration }) }
    ),

  searchUsers: (q: string, friendsOnly?: boolean) =>
    request<UserSearchResult[]>(
      `/messages/users/search?q=${encodeURIComponent(q)}${friendsOnly ? "&friends_only=true" : ""}`
    ),

  forwardMessage: (
    messageId: string,
    to_receiver_id?: string,
    to_room_id?: string
  ) =>
    request<Message>(`/messages/${messageId}/forward`, {
      method: "POST",
      body: JSON.stringify({ to_receiver_id, to_room_id }),
    }),

  toggleStar: (messageId: string) =>
    request<{ ok: boolean; starred: boolean }>(
      `/messages/${messageId}/star`,
      { method: "PUT" }
    ),

  searchMessages: (q: string, limit?: number) =>
    request<Message[]>(
      `/messages/search${buildQuery({ q, limit })}`
    ),

  searchRoomMessages: (
    roomId: string,
    q: string,
    limit?: number
  ) =>
    request<Message[]>(
      `/messages/rooms/${roomId}/messages/search${buildQuery({ q, limit })}`
    ),

  archiveRoom: (roomId: string) =>
    request<{ ok: boolean }>(`/messages/rooms/${roomId}/archive`, {
      method: "PUT",
    }),

  unarchiveRoom: (roomId: string) =>
    request<{ ok: boolean }>(
      `/messages/rooms/${roomId}/archive`,
      { method: "DELETE" }
    ),

  scheduleMessage: (data: {
    body?: string;
    kind?: string;
    receiver_id?: string;
    room_id?: string;
    scheduled_at: string;
    metadata?: Record<string, unknown>;
  }) =>
    request<Message>("/messages/scheduled", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getScheduledMessages: () => request<Message[]>("/messages/scheduled"),

  cancelScheduledMessage: (messageId: string) =>
    request<{ ok: boolean }>(
      `/messages/${messageId}/scheduled`,
      { method: "DELETE" }
    ),

  getRoomMedia: (roomId: string, limit?: number) =>
    request<Message[]>(
      `/messages/rooms/${roomId}/media${buildQuery({ limit })}`
    ),

  getDmMedia: (userId: string, limit?: number) =>
    request<Message[]>(
      `/messages/dm/${userId}/media${buildQuery({ limit })}`
    ),

  exportRoomChat: (roomId: string, format: "txt" | "json" = "txt"): Promise<Blob> =>
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:8000")}/messages/rooms/${roomId}/export?format=${format}`,
      { method: "GET", credentials: "include" }
    ).then((r) => r.blob()),

  exportDmChat: (userId: string, format: "txt" | "json" = "txt"): Promise<Blob> =>
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:8000")}/messages/dm/${userId}/export?format=${format}`,
      { method: "GET", credentials: "include" }
    ).then((r) => r.blob()),

  pinConversation: (convType: "dm" | "room", convId: string) =>
    request<{ ok: boolean; pinned_at: string | null }>(
      `/messages/conversations/${convType}/${convId}/pin`,
      { method: "PUT" }
    ),

  unpinConversation: (convType: "dm" | "room", convId: string) =>
    request<{ ok: boolean }>(
      `/messages/conversations/${convType}/${convId}/pin`,
      { method: "DELETE" }
    ),

  transcribeAudio: (blob: Blob): Promise<{ text: string }> => {
    const file = new File([blob], "voice.wav", { type: "audio/wav" });
    return import("../core").then(({ uploadFile }) =>
      uploadFile("/messages/transcribe", file)
    );
  },
};