/** Events API client */

import { request, buildQuery } from "@/lib/api/core";
import type {
  Event,
  EventListResponse,
  EventCreate,
  EventUpdate,
  RSVPStatus,
  RSVPResponse,
  RSVPListItem,
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
      // Trailing slash BEFORE the query: the backend route is `@router.get("/")`
      // (path `/events/`). Calling `/events?...` makes FastAPI 307-redirect to the
      // absolute http:// backend URL, which the https page blocks as mixed content
      // ("Failed to fetch"). Hitting `/events/?...` directly avoids the redirect.
      `${EVENTS_BASE}/${buildQuery({
        ...params,
        upcoming_only: params.upcoming_only === true ? "true" : params.upcoming_only === false ? "false" : undefined,
      })}`
    ),

  get: (eventId: string) => request<Event>(`${EVENTS_BASE}/${eventId}`),

  // The room's single live event (upcoming or in progress), or null.
  // Trailing-slash note in `list` does not apply: this is a literal sub-path.
  getCurrent: (roomId: string) =>
    request<Event | null>(`${EVENTS_BASE}/current${buildQuery({ room_id: roomId })}`),

  create: (data: EventCreate) =>
    // Trailing slash: backend route is `@router.post("/")`. See note in `list`.
    request<Event>(`${EVENTS_BASE}/`, {
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

  listRsvps: (eventId: string) => request<RSVPListItem[]>(`${EVENTS_BASE}/${eventId}/rsvps`),

  removeRsvp: (eventId: string) =>
    request<void>(`${EVENTS_BASE}/${eventId}/rsvp`, { method: "DELETE" }),

  // Marks the welcome animation as seen; first_time=true only on the first view.
  markSeen: (eventId: string) =>
    request<{ first_time: boolean }>(`${EVENTS_BASE}/${eventId}/seen`, { method: "POST" }),

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
