/** Events API client */

import { request, buildQuery } from "@/lib/api/core";
import type {
  Event,
  EventListResponse,
  EventCreate,
  EventUpdate,
  RSVPStatus,
  RSVPResponse,
  ReminderTime,
  ReminderSettingsResponse,
  VisibilitySettingsResponse,
} from "./events";

const EVENTS_BASE = "/events";

export const eventsApi = {
  // Visibility settings (admin only)
  getVisibility: () => request<VisibilitySettingsResponse>(`${EVENTS_BASE}/visibility`),
  setVisibility: (enabled: boolean) =>
    request<VisibilitySettingsResponse>(`${EVENTS_BASE}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  // CRUD
  list: (params: {
    room_id: string;
    status?: string;
    upcoming_only?: boolean;
    limit?: number;
    offset?: number;
  }) =>
    request<EventListResponse>(
      `${EVENTS_BASE}${buildQuery({
        ...params,
        upcoming_only: params.upcoming_only === true ? "true" : params.upcoming_only === false ? "false" : undefined,
      })}`
    ),

  get: (eventId: string) => request<Event>(`${EVENTS_BASE}/${eventId}`),

  create: (data: EventCreate) =>
    request<Event>(EVENTS_BASE, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (eventId: string, data: EventUpdate) =>
    request<Event>(`${EVENTS_BASE}/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (eventId: string) =>
    request<void>(`${EVENTS_BASE}/${eventId}`, { method: "DELETE" }),

  // RSVP
  rsvp: (eventId: string, status: RSVPStatus) =>
    request<RSVPResponse>(`${EVENTS_BASE}/${eventId}/rsvp`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),

  listRsvps: (eventId: string) => request<RSVPResponse[]>(`${EVENTS_BASE}/${eventId}/rsvps`),

  removeRsvp: (eventId: string) =>
    request<void>(`${EVENTS_BASE}/${eventId}/rsvp`, { method: "DELETE" }),

  // Reminders
  getReminder: (eventId: string) =>
    request<ReminderSettingsResponse>(`${EVENTS_BASE}/${eventId}/reminder`),

  setReminder: (eventId: string, reminder_time: ReminderTime) =>
    request<ReminderSettingsResponse>(`${EVENTS_BASE}/${eventId}/reminder`, {
      method: "PATCH",
      body: JSON.stringify({ reminder_time }),
    }),

  // Voice channel linking
  linkVoiceChannel: (eventId: string, voice_channel_id: string) =>
    request<Event>(`${EVENTS_BASE}/${eventId}/voice-channel`, {
      method: "POST",
      body: JSON.stringify({ voice_channel_id }),
    }),

  unlinkVoiceChannel: (eventId: string) =>
    request<Event>(`${EVENTS_BASE}/${eventId}/voice-channel`, { method: "DELETE" }),
};
