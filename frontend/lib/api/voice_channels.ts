import { request } from "./core";

export interface VoiceChannelParticipant {
  id: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
  muted: boolean;
  deafened: boolean;
  video_enabled: boolean;
  screen_sharing: boolean;
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
    last_active_at?: string;
  };
}

export interface VoiceChannelResponse {
  id: string;
  room_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  participants: VoiceChannelParticipant[];
}

export interface VoiceChannelBrief {
  id: string;
  room_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  participant_count: number;
}

export interface VoiceChannelCreate {
  room_id: string;
  name: string;
  description?: string;
}

export interface MuteStateUpdate {
  muted?: boolean;
  deafened?: boolean;
  video_enabled?: boolean;
  screen_sharing?: boolean;
}

export const voiceChannelsApi = {
  listForRoom: (roomId: string) =>
    request<VoiceChannelBrief[]>(`/messages/voice/rooms/${roomId}/channels`),

  get: (channelId: string) =>
    request<VoiceChannelResponse>(`/messages/voice/channels/${channelId}`),

  create: (roomId: string, data: { name: string; description?: string }) =>
    request<VoiceChannelResponse>(`/messages/voice/rooms/${roomId}/channels`, {
      method: "POST",
      body: JSON.stringify({ room_id: roomId, ...data }),
    }),

  update: (channelId: string, data: { name?: string; description?: string }) =>
    request<VoiceChannelResponse>(`/messages/voice/channels/${channelId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (channelId: string) =>
    request<void>(`/messages/voice/channels/${channelId}`, { method: "DELETE" }),

  join: (channelId: string) =>
    request<VoiceChannelParticipant>(`/messages/voice/channels/${channelId}/join`, {
      method: "POST",
    }),

  leave: (channelId: string) =>
    request<void>(`/messages/voice/channels/${channelId}/leave`, {
      method: "POST",
    }),

  updateMe: (channelId: string, data: MuteStateUpdate) =>
    request<VoiceChannelParticipant>(`/messages/voice/channels/${channelId}/me`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};