"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { toastError, toastSuccess } from "@/lib/toastStore";
import type { PackStore, UserPack, OpenPackResult } from "@/lib/api";

export interface UsePacksReturn {
  store: PackStore | null;
  loading: boolean;
  buying: boolean;
  opening: boolean;
  exchanging: boolean;
  buy: (packTypeId: string) => Promise<UserPack | null>;
  open: (packId: string) => Promise<OpenPackResult | null>;
  exchange: (cardIds: string[]) => Promise<UserPack | null>;
  refresh: () => Promise<void>;
}

export function usePacks(): UsePacksReturn {
  const { setUser } = useAuthStore();
  const [store, setStore] = useState<PackStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [opening, setOpening] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.getMe());
    } catch (e) {
      toastError("No se pudo actualizar tu saldo", e);
    }
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getStore();
        if (!cancelled) setStore(data);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar la tienda de sobres", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setStore(await api.getStore());
    } catch (e) {
      toastError("No se pudo cargar la tienda de sobres", e);
    }
  }, []);

  const buy = useCallback(
    async (packTypeId: string) => {
      setBuying(true);
      try {
        const pack = await api.buy(packTypeId);
        await refresh();
        await refreshUser();
        toastSuccess("¡Sobre comprado!", "Llegó a tu bandeja de sobres");
        return pack;
      } catch (e) {
        toastError("No se pudo comprar el sobre", e);
        return null;
      } finally {
        setBuying(false);
      }
    },
    [refresh, refreshUser]
  );

  const open = useCallback(
    async (packId: string) => {
      setOpening(true);
      try {
        const result = await api.open(packId);
        await refresh();
        return result;
      } catch (e) {
        toastError("No se pudo abrir el sobre", e);
        return null;
      } finally {
        setOpening(false);
      }
    },
    [refresh]
  );

  const exchange = useCallback(
    async (cardIds: string[]) => {
      setExchanging(true);
      try {
        const pack = await api.exchange(cardIds);
        await refresh();
        toastSuccess("¡Canje exitoso!", "3 duplicados → 1 sobre de Lechuza");
        return pack;
      } catch (e) {
        toastError("No se pudo canjear", e);
        return null;
      } finally {
        setExchanging(false);
      }
    },
    [refresh]
  );

  return { store, loading, buying, opening, exchanging, buy, open, exchange, refresh };
}