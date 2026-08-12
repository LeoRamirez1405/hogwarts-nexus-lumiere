"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import type { LevelUpEvent } from "@/components/ui/LevelUpCelebration";

export function useLevelUpWatcher() {
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<LevelUpEvent[]>([]);
  const prevLevel = useRef<number | null>(null);
  const prevUserId = useRef<string | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const ml = user?.magic_level;
    if (!user || !ml) return;
    const level = ml.level;
    if (user.id !== prevUserId.current) {
      prevUserId.current = user.id;
      prevLevel.current = level;
      return;
    }
    if (prevLevel.current !== null && level > prevLevel.current) {
      idRef.current += 1;
      const ev: LevelUpEvent = {
        id: idRef.current,
        kind: "user",
        title: `Nivel Mágico ${level}`,
        subtitle: ml.name,
      };
      setEvents((q) => [...q, ev].slice(-3));
    }
    prevLevel.current = level;
  }, [user]);

  const dismiss = useCallback(() => setEvents((q) => q.slice(1)), []);

  return { event: events[0] ?? null, dismiss };
}
