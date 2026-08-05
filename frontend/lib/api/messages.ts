import { request, buildQuery, uploadFile, API_BASE_VALUE } from "./core";
import type { PaginationParams, Page } from "./core";
import type { UserSearchResult } from "./users";
import type {
  Conversation,
  ChatRoomBrief,
  ChatRoomMemberResponse,
  ChatRoomResponse,
  CreateRoomData,
  Message,
  MessagePage,
  MessageReaction,
  MessageSendData,
  UpdateRoomData,
  RoomInviteCreate,
  RoomInviteResponse,
  RoomInviteInfoResponse,
  LinkPreviewResponse,
} from "./messagesTypes";

const API_BASE = API_BASE_VALUE;

export * from "./messagesTypes";

export const messagesApi = {
  getConversations: () =>
    request<Conversation[]>("/messages/conversations"),

  getMessages: (userId: string, limit?: number, before?: string, expand = "sender,reactions,reply_to") =>
    request<MessagePage>(
      `/messages/${userId}${buildQuery({ limit, before, expand })}`
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

  getRoomMessages: (roomId: string, limit?: number, before?: string, expand = "sender,reactions,reply_to") =>
    request<MessagePage>(
      `/messages/rooms/${roomId}/messages${buildQuery({ limit, before, expand })}`
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
    request<ChatRoomResponse>("/admin/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRoom: (roomId: string, data: UpdateRoomData) =>
    request<ChatRoomResponse>(`/messages/rooms/${roomId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteRoom: (roomId: string) =>
    request<void>(`/admin/rooms/${roomId}`, { method: "DELETE" }),

  addRoomMember: (roomId: string, userId: string, role?: string) =>
    request<ChatRoomMemberResponse>(
      `/admin/rooms/${roomId}/members?user_id=${userId}${role ? `&role=${role}` : ""}`,
      { method: "POST" }
    ),

  addRoomMembersBatch: (
    roomId: string,
    userIds: string[],
    role?: string
  ) => {
    const params = new URLSearchParams();
    userIds.forEach((id) => params.append("user_id", id));
    if (role) params.append("role", role);
    const qs = params.toString();
    return request<ChatRoomMemberResponse[]>(
      `/admin/rooms/${roomId}/members/batch${qs ? `?${qs}` : ""}`,
      { method: "POST" }
    );
  },

  removeRoomMember: (roomId: string, userId: string) =>
    request<void>(`/admin/rooms/${roomId}/members/${userId}`, {
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
      `/admin/rooms/${roomId}/toggle-close`,
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
    duration: "1h" | "8h" | "24h" | "7d" | "forever" | "off"
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

  getStarredMessages: (limit?: number) =>
    request<Message[]>(
      `/messages/starred${buildQuery({ limit })}`
    ),

  getMessagesSince: (lastId: string, limit?: number, expand = "sender,reactions,reply_to") =>
    request<Message[]>(
      `/messages/since/${lastId}${buildQuery({ limit, expand })}`
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

  searchDmMessages: (
    userId: string,
    q: string,
    limit?: number
  ) =>
    request<Message[]>(
      `/messages/dm/${userId}/messages/search${buildQuery({ q, limit })}`
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
      `${API_BASE}/messages/rooms/${roomId}/export?format=${format}`,
      { method: "GET", credentials: "include" }
    ).then((r) => r.blob()),

  exportDmChat: (userId: string, format: "txt" | "json" = "txt"): Promise<Blob> =>
    fetch(
      `${API_BASE}/messages/dm/${userId}/export?format=${format}`,
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
    return uploadFile("/messages/transcribe", file);
  },

  // Room invites
  createRoomInvite: (roomId: string, data: RoomInviteCreate) =>
    request<RoomInviteResponse>(`/messages/rooms/${roomId}/invites`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getRoomInvites: (roomId: string) =>
    request<RoomInviteResponse[]>(`/messages/rooms/${roomId}/invites`),

  revokeRoomInvite: (roomId: string, inviteId: string) =>
    request<void>(`/messages/rooms/${roomId}/invites/${inviteId}`, {
      method: "DELETE",
    }),

  getInviteInfo: (token: string) =>
    request<RoomInviteInfoResponse>(`/messages/invites/${token}`),

  joinRoomByInvite: (token: string) =>
    request<RoomInviteInfoResponse>(`/messages/invites/${token}/join`, {
      method: "POST",
    }),

  // Member role & approval
  changeMemberRole: (roomId: string, memberId: string, role: "admin" | "member") =>
    request<ChatRoomMemberResponse>(
      `/admin/rooms/${roomId}/members/${memberId}/role`,
      { method: "PUT", body: JSON.stringify({ role }) }
    ),

  approvePendingMember: (roomId: string, userId: string, action: "approve" | "reject") =>
    request<ChatRoomMemberResponse | { ok: boolean; rejected: boolean }>(
      `/admin/rooms/${roomId}/members/approve`,
      { method: "POST", body: JSON.stringify({ user_id: userId, action }) }
    ),

  getPendingMembers: (roomId: string) =>
    request<ChatRoomMemberResponse[]>(`/admin/rooms/${roomId}/members/pending`),

  // Link preview
  getLinkPreview: (url: string) =>
    request<LinkPreviewResponse>("/messages/link-preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
};
