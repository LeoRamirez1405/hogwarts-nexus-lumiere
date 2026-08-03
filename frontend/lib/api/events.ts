/** Event types for frontend */

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type EventLocationType = 'physical' | 'voice_channel' | 'external_link' | 'text_only';
export type RSVPStatus = 'going' | 'maybe' | 'not_going';
export type ReminderTime = 'at_time' | '15min' | '1h' | '3h' | '1d' | '3d' | '1w';

export interface Event {
  id: string;
  room_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: EventStatus;
  starts_at: string; // ISO datetime
  ends_at: string | null;
  location_type: EventLocationType;
  location_name: string | null;
  location_url: string | null;
  voice_channel_id: string | null;
  voice_channel?: { id: string; name: string } | null;
  max_attendees: number | null;
  require_approval: boolean;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  creator?: { id: string; name: string; avatar_url: string | null; house: string | null } | null;
  rsvp_counts: Record<RSVPStatus, number>;
  my_rsvp: RSVPStatus | null;
  reminder_time: ReminderTime | null;
}

export interface EventListResponse {
  events: Event[];
  has_more: boolean;
}

export interface EventCreate {
  room_id: string;
  title: string;
  description?: string;
  starts_at: string; // ISO datetime
  ends_at?: string;
  location_type: EventLocationType;
  location_name?: string;
  location_url?: string;
  create_voice_channel: boolean;
  voice_channel_name?: string;
  max_attendees?: number;
  require_approval: boolean;
}

export interface EventUpdate {
  title?: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  location_type?: EventLocationType;
  location_name?: string;
  location_url?: string;
  max_attendees?: number;
  require_approval?: boolean;
  status?: EventStatus;
}

export interface RSVPRequest {
  status: RSVPStatus;
}

export interface RSVPResponse {
  event_id: string;
  user_id: string;
  status: RSVPStatus;
  responded_at: string;
}

export interface ReminderSettingsRequest {
  reminder_time: ReminderTime;
}

export interface ReminderSettingsResponse {
  event_id: string;
  user_id: string;
  reminder_time: ReminderTime;
}

export interface VisibilitySettingsResponse {
  enabled: boolean;
}

export interface VoiceChannelLinkRequest {
  voice_channel_id: string;
}

// RSVP display labels
export const RSVP_LABELS: Record<RSVPStatus, { label: string; icon: string; color: string }> = {
  going: { label: 'Voy', icon: 'check_circle', color: 'text-emerald-600 bg-emerald-50' },
  maybe: { label: 'Quizás', icon: 'help', color: 'text-amber-600 bg-amber-50' },
  not_going: { label: 'No voy', icon: 'cancel', color: 'text-red-600 bg-red-50' },
};

// Reminder time display labels
export const REMINDER_LABELS: Record<ReminderTime, string> = {
  at_time: 'En el momento',
  '15min': '15 min antes',
  '1h': '1 hora antes',
  '3h': '3 horas antes',
  '1d': '1 día antes',
  '3d': '3 días antes',
  '1w': '1 semana antes',
};

// Location type display labels
export const LOCATION_LABELS: Record<EventLocationType, { label: string; icon: string }> = {
  physical: { label: 'Presencial', icon: 'location_on' },
  voice_channel: { label: 'Canal de voz', icon: 'mic' },
  external_link: { label: 'Enlace externo', icon: 'link' },
  text_only: { label: 'Solo chat', icon: 'chat' },
};