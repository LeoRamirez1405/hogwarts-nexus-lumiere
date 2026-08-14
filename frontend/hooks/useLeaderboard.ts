"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toastError } from "@/lib/toastStore";
import type { Leaderboard } from "@/lib/api";

export function useLeaderboard(albumId?: string): Leaderboard | null {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    if (!albumId) return;
    let cancelled = false;
    api
      .getLeaderboard(albumId)
      .then((data) => {
        if (!cancelled) setLeaderboard(data);
      })
      .catch((e) => {
        if (!cancelled) toastError("No se pudo cargar el ranking", e);
      });
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  return leaderboard;
}