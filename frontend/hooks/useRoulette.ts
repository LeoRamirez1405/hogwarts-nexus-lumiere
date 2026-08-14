"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { toastError } from "@/lib/toastStore";
import type { RouletteConfig, RouletteSpin, SpinResult } from "@/lib/api";

export interface UseRouletteReturn {
  config: RouletteConfig | null;
  history: RouletteSpin[];
  spinning: boolean;
  spin: () => Promise<SpinResult | null>;
  refresh: () => Promise<void>;
}

export function useRoulette(): UseRouletteReturn {
  const { setUser } = useAuthStore();
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [history, setHistory] = useState<RouletteSpin[]>([]);
  const [spinning, setSpinning] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.getMe());
    } catch (e) {
      toastError("No se pudo actualizar tu saldo", e);
    }
  }, [setUser]);

  const refresh = useCallback(async () => {
    try {
      setConfig(await api.getConfig());
      setHistory(await api.getHistory());
    } catch (e) {
      toastError("No se pudo cargar la ruleta", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, hist] = await Promise.all([api.getConfig(), api.getHistory()]);
        if (cancelled) return;
        setConfig(cfg);
        setHistory(hist);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar la ruleta", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const spin = useCallback(async () => {
    if (spinning) return null;
    setSpinning(true);
    try {
      const result = await api.spin();
      await refresh();
      await refreshUser();
      return result;
    } catch (e) {
      toastError("No se pudo girar la ruleta", e);
      return null;
    } finally {
      setSpinning(false);
    }
  }, [spinning, refresh, refreshUser]);

  return { config, history, spinning, spin, refresh };
}