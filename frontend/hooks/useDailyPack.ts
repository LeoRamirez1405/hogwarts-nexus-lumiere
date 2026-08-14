"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toastStore";
import type { DailyPackStatus, UserPack } from "@/lib/api";

export interface UseDailyPackReturn {
  status: DailyPackStatus | null;
  claiming: boolean;
  claim: () => Promise<UserPack | null>;
  refresh: () => Promise<void>;
}

export function useDailyPack(): UseDailyPackReturn {
  const [status, setStatus] = useState<DailyPackStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.getDailyStatus());
    } catch (e) {
      toastError("No se pudo cargar el sobre diario", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getDailyStatus();
        if (!cancelled) setStatus(data);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar el sobre diario", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const claim = useCallback(async () => {
    setClaiming(true);
    try {
      const pack = await api.claimDaily();
      await refresh();
      toastSuccess("¡Sobre diario reclamado!", "Llegó a tu bandeja de sobres");
      return pack;
    } catch (e) {
      toastError("No se pudo reclamar el sobre diario", e);
      return null;
    } finally {
      setClaiming(false);
    }
  }, [refresh]);

  return { status, claiming, claim, refresh };
}