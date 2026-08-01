"use client";

import { useEffect, useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import { toastError } from "@/lib/toastStore";
import type { Creature, UserCreature, PetItem, UserPetItem, MarketCreature, SanctuaryStats, EnumValue } from "@/lib/api";
import type { UsePetsDataReturn } from "../components/types";

export function usePetsData(): UsePetsDataReturn {
  const { setUser } = useAuthStore();
  const showMarket = useFeatureFlag("pets.market");
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [myCreatures, setMyCreatures] = useState<UserCreature[]>([]);
  const [myCreaturesSkip, setMyCreaturesSkip] = useState(0);
  const [myCreaturesHasMore, setMyCreaturesHasMore] = useState(false);
  const [loadingMoreMy, setLoadingMoreMy] = useState(false);
  const [petItems, setPetItems] = useState<PetItem[]>([]);
  const [inventory, setInventory] = useState<UserPetItem[]>([]);
  const [market, setMarket] = useState<MarketCreature[]>([]);
  const [marketSkip, setMarketSkip] = useState(0);
  const [marketHasMore, setMarketHasMore] = useState(false);
  const [loadingMoreMarket, setLoadingMoreMarket] = useState(false);
  const [stats, setStats] = useState<SanctuaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [petTypeValues, setPetTypeValues] = useState<EnumValue[]>([]);

  const refreshStats = useCallback(async () => {
      try {
        const s = await api.getSanctuaryStats();
        setStats(s);
      } catch (e) {
        toastError("No se pudo actualizar las estadísticas del santuario", e);
      }
    },
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch (e) {
      toastError("No se pudo actualizar tu perfil", e);
    }
  }, [setUser]);

  const loadMoreMyCreatures = useCallback(async () => {
    setLoadingMoreMy(true);
    try {
      const page = await api.getMyCreaturesPage({ skip: myCreaturesSkip, limit: 50 });
      setMyCreatures((prev) => [...prev, ...page.items]);
      setMyCreaturesSkip((s) => s + 50);
      setMyCreaturesHasMore(page.has_more);
    } catch (e) {
      toastError("No se pudieron cargar más mascotas", e);
    } finally {
      setLoadingMoreMy(false);
    }
  }, [myCreaturesSkip]);

  const loadMoreMarket = useCallback(async () => {
    setLoadingMoreMarket(true);
    try {
      const page = await api.getCreatureMarketPage({ skip: marketSkip, limit: 50 });
      setMarket((prev) => [...prev, ...page.items]);
      setMarketSkip((s) => s + 50);
      setMarketHasMore(page.has_more);
    } catch (e) {
      toastError("No se pudieron cargar más mascotas del mercado", e);
    } finally {
      setLoadingMoreMarket(false);
    }
  }, [marketSkip]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await api.getMyFullState(showMarket);
        if (cancelled) return;
        setCreatures(state.creatures);
        setMyCreatures(state.my_creatures);
        setMyCreaturesSkip(state.my_creatures_limit);
        setMyCreaturesHasMore(state.my_creatures_has_more);
        setPetItems(state.pet_items);
        setInventory(state.inventory);
        setStats(state.stats);
        setMarket(state.market ?? []);
        setMarketSkip(state.market_limit ?? 0);
        setMarketHasMore(state.market_has_more ?? false);
        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        setLoadError("No se pudo cargar la menajería. Reviva el santuario y vuelva a intentarlo.");
        toastError("No se pudo cargar la menajería", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const cat = await api.getEnumCategoryByCode("pet_type");
        if (cancelled) return;
        if (cat) setPetTypeValues(cat.values);
      } catch (e) {
        toastError("No se pudieron cargar los tipos de mascota", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showMarket]);

  return {
    creatures,
    myCreatures,
    myCreaturesSkip,
    myCreaturesHasMore,
    loadingMoreMy,
    petItems,
    inventory,
    market,
    marketSkip,
    marketHasMore,
    loadingMoreMarket,
    stats,
    loading,
    loadError,
    petTypeValues,
    setMyCreatures,
    setInventory,
    setMarket,
    setLoadError,
    setLoading,
    refreshStats,
    loadMoreMyCreatures,
    loadMoreMarket,
    refreshUser,
  };
}