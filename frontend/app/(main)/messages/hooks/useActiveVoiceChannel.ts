"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { voiceChannelsApi, VoiceChannelBrief } from "@/lib/api/voice_channels";
import { ApiError } from "@/lib/api/core/errors";

const POLL_INTERVAL_MS = 15000;

/**
 * Lightweight poller that surfaces the "active" voice channel of a room — the
 * one members can jump into quickly. With single voice channel per room,
 * a channel counts as active when it exists. Returns the active channel (or null).
 *
 * Used to render the sticky voice-chat bar below the pinned messages so every
 * member sees, and can join, a voice chat an admin started.
 */
export function useActiveVoiceChannel(roomId: string | null | undefined, enabled: boolean) {
  const [active, setActive] = useState<VoiceChannelBrief | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track which room the poller is bound to so we can reset the active channel
  // synchronously (adjusting state during render) when the room changes or the
  // poll is disabled — otherwise the previous room's bar would flash.
  const [activeRoomKey, setActiveRoomKey] = useState<string | null>(
    enabled ? (roomId ?? null) : null
  );
  const nextRoomKey = enabled ? (roomId ?? null) : null;
  if (nextRoomKey !== activeRoomKey) {
    setActiveRoomKey(nextRoomKey);
    if (active !== null) setActive(null);
  }

  const refresh = useCallback(async () => {
    if (!roomId || !enabled) return;
    try {
      const list = await voiceChannelsApi.listForRoom(roomId);
      const activeChannel = list[0] ?? null;
      setActive(activeChannel);
    } catch (err) {
      // The user is no longer a member of this room (or was never one, e.g. a
      // global admin inspecting a room created by someone else before the
      // backend membership bypass). Stop polling to avoid spamming errors and
      // clear any stale active channel instead of logging every 15s.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setActive(null);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      console.error("Failed to poll voice channels", err);
    }
  }, [roomId, enabled]);

  useEffect(() => {
    if (!roomId || !enabled) return;
    // Async poll — setState only runs after the awaited fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [roomId, enabled, refresh]);

  return { active, refresh };
}
