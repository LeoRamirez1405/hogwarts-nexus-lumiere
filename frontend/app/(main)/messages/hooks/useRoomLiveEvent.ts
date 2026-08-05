"use client";

import { useCallback, useEffect, useState } from "react";
import { eventsApi } from "@/lib/api/eventsApi";
import type { Event } from "@/lib/api/events";
import { wsClient, type WSMessage } from "@/lib/ws";

// Event WS message types that should re-fetch the room's live event.
const EVENT_WS_TYPES = [
  "event_created",
  "event_updated",
  "event_started",
  "event_ended",
  "event_cancelled",
  "event_rsvp_updated",
];

/**
 * Tracks the room's single live event (upcoming or in progress) and keeps it
 * fresh via WebSocket. Returns null when the room has no live event.
 */
export function useRoomLiveEvent(roomId: string | undefined, enabled: boolean) {
  const [liveEvent, setLiveEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);

  // Refresh used by the WS handlers (fired inside callbacks, not during render).
  const refresh = useCallback(async () => {
    if (!roomId || !enabled) return;
    try {
      setLoading(true);
      const ev = await eventsApi.getCurrent(roomId);
      setLiveEvent(ev ?? null);
    } catch {
      setLiveEvent(null);
    } finally {
      setLoading(false);
    }
  }, [roomId, enabled]);

  // Initial load + reload when the room changes. A cancelled flag drops stale
  // responses when the room switches mid-request.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!roomId || !enabled) {
        if (!cancelled) setLiveEvent(null);
        return;
      }
      try {
        const ev = await eventsApi.getCurrent(roomId);
        if (!cancelled) setLiveEvent(ev ?? null);
      } catch {
        if (!cancelled) setLiveEvent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, enabled]);

  // Live updates: any event change in this room re-fetches the current event.
  useEffect(() => {
    if (!roomId || !enabled) return;
    const handler = (msg: WSMessage) => {
      if (msg.c && msg.c !== roomId) return; // event_reminder has no room; skip only cross-room
      refresh();
    };
    const unsubs = EVENT_WS_TYPES.map((t) => wsClient.on(t, handler));
    return () => unsubs.forEach((u) => u());
  }, [roomId, enabled, refresh]);

  return { liveEvent, loading, refresh };
}
