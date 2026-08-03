/** Events API client */

import { api } from '@/lib/api';
import type {
  Event,
  EventListResponse,
  EventCreate,
  EventUpdate,
  RSVPRequest,
  RSVPResponse,
  ReminderSettingsRequest,
  ReminderSettingsResponse,
  VisibilitySettingsResponse,
  VoiceChannelLinkRequest,
} from './events';

const EVENTS_BASE = '/events';

export const eventsApi = {
  // Visibility settings (admin only)
  getVisibility: () => api.get<VisibilitySettingsResponse>(`${EVENTS_BASE}/visibility`),
  setVisibility: (enabled: boolean) => api.patch<VisibilitySettingsResponse>(`${EVENTS_BASE}/visibility`, { enabled }),

  // CRUD
  list: (params: {
    room_id: string;
    status?: string;
    upcoming_only?: boolean;
    limit?: number;
    offset?: number;
  }) => api.get<EventListResponse>(EVENTS_BASE, { params }),

  get: (eventId: string) => api.get<Event>(`${EVENTS_BASE}/${eventId}`),

  create: (data: EventCreate) => api.post<Event>(EVENTS_BASE, data),

  update: (eventId: string, data: EventUpdate) => api.patch<Event>(`${EVENTS_BASE}/${eventId}`, data),

  delete: (eventId: string) => api.delete(`${EVENTS_BASE}/${eventId}`),

  // RSVP
  rsvp: (eventId: string, status: RSVPRequest['status']) =>
    api.post<RSVPResponse>(`${EVENTS_BASE}/${eventId}/rsvp`, { status }),

  listRsvps: (eventId: string) => api.get<RSVPResponse[]>(`${EVENTS_BASE}/${eventId}/rsvps`),

  removeRsvp: (eventId: string) => api.delete(`${EVENTS_BASE}/${eventId}/rsvp`),

  // Reminders
  getReminder: (eventId: string) => api.get<ReminderSettingsResponse>(`${EVENTS_BASE}/${eventId}/reminder`),

  setReminder: (eventId: string, reminder_time: ReminderSettingsRequest['reminder_time']) =>
    api.patch<ReminderSettingsResponse>(`${EVENTS_BASE}/${eventId}/reminder`, { reminder_time }),

  // Voice channel linking
  linkVoiceChannel: (eventId: string, voice_channel_id: string) =>
    api.post<Event>(`${EVENTS_BASE}/${eventId}/voice-channel`, { voice_channel_id }),

  unlinkVoiceChannel: (eventId: string) => api.delete<Event>(`${EVENTS_BASE}/${eventId}/voice-channel`),
};