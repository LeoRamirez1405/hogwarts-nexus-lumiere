"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toastStore";
import type { Creature, UserCreature, UserPetItem, MarketCreature, PetItem } from "@/lib/api";
import type { UsePetActionsReturn, UsePetActionsParams } from "../components/types";

export function usePetActions({
  myCreatures,
  setMyCreatures,
  inventory,
  setInventory,
  market,
  setMarket,
  user,
  setUser,
  refreshStats,
  refreshUser,
  petLevels,
  pushCelebration,
  sellPrice,
}: UsePetActionsParams): UsePetActionsReturn {
  const [adopting, setAdopting] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [buyingPet, setBuyingPet] = useState<string | null>(null);

  const detectPetLevelUp = useCallback(
    (uc: UserCreature) => {
      const prev = petLevels.current[uc.id];
      if (prev !== undefined && uc.level > prev) {
        pushCelebration({
          kind: "pet",
          title: uc.creature?.name ?? "Tu mascota",
          subtitle: `Nivel ${uc.level} · ${uc.level_name}`,
        });
      }
      // eslint-disable-next-line react-hooks/immutability
      petLevels.current[uc.id] = uc.level;
    },
    [petLevels, pushCelebration]
  );

  const handleAdopt = useCallback(
    async (creature: Creature, petName?: string) => {
      setAdopting(creature.id);
      const prevMyCreatures = myCreatures;
      const prevUser = user;
      try {
        const adopted = await api.adoptCreature(creature.id, petName);
        // eslint-disable-next-line react-hooks/immutability
        petLevels.current[adopted.id] = adopted.level;
        setMyCreatures((prev) => [...prev, adopted]);
        await refreshUser();
        await refreshStats();
        toastSuccess(`${petName ?? adopted.creature?.name ?? "Tu mascota"} te acompaña ahora`);
      } catch (e) {
        setMyCreatures(prevMyCreatures);
        if (prevUser) setUser(prevUser);
        toastError("No se pudo adoptar la criatura", e);
      } finally {
        setAdopting(null);
      }
    },
    [myCreatures, user, setMyCreatures, setUser, petLevels, refreshStats, refreshUser]
  );

  const handleBuy = useCallback(
    async (item: PetItem) => {
      setBuying(item.id);
      const prevInventory = inventory;
      const prevUser = user;
      try {
        const row = await api.buyPetItem(item.id, 1);
        setInventory((prev) => {
          const idx = prev.findIndex((r) => r.pet_item_id === item.id);
          if (idx === -1) return [...prev, { ...row, pet_item: item }];
          const next = [...prev];
          next[idx] = { ...row, pet_item: item };
          return next;
        });
        await refreshUser();
        await refreshStats();
        toastSuccess(`${item.name} añadido a tu inventario`);
      } catch (e) {
        setInventory(prevInventory);
        if (prevUser) setUser(prevUser);
        toastError("No se pudo comprar el item", e);
      } finally {
        setBuying(null);
      }
    },
    [inventory, user, setInventory, setUser, refreshStats, refreshUser]
  );

  const handleUse = useCallback(
    async (uc: UserCreature, item: UserPetItem) => {
      if (!item.pet_item) return;
      const mode = item.pet_item.kind === "food" ? "feed" : "play";
      setUsing(item.id);
      const prevCreatures = myCreatures;
      const prevInventory = inventory;
      try {
        const updated =
          mode === "feed"
            ? await api.feedCreature(uc.id, item.pet_item_id)
            : await api.playCreature(uc.id, item.pet_item_id);
        detectPetLevelUp(updated);
        setMyCreatures((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setInventory((prev) =>
          prev
            .map((r) => (r.id === item.id ? { ...r, quantity: r.quantity - 1 } : r))
            .filter((r) => r.quantity > 0)
        );
        await refreshStats();
      } catch (e) {
        setMyCreatures(prevCreatures);
        setInventory(prevInventory);
        toastError("No se pudo usar el item", e);
      } finally {
        setUsing(null);
      }
    },
    [myCreatures, inventory, setMyCreatures, setInventory, detectPetLevelUp, refreshStats]
  );

  const handleListForSale = useCallback(
    async (ucId: string) => {
      const price = parseInt(sellPrice) || 0;
      if (price <= 0) {
        toastError("Ingresa un precio valido para vender");
        return;
      }
      try {
        const updated = await api.listCreatureForSale(ucId, price);
        setMyCreatures((prev) => prev.map((c) => (c.id === ucId ? updated : c)));
        toastSuccess("Tu mascota esta a la venta en el mercado");
      } catch (e) {
        toastError("No se pudo publicar la mascota en el mercado", e);
      }
    },
    [setMyCreatures, sellPrice]
  );

  const handleUnlist = useCallback(
    async (ucId: string) => {
      try {
        const updated = await api.unlistCreature(ucId);
        setMyCreatures((prev) => prev.map((c) => (c.id === ucId ? updated : c)));
        toastSuccess("Tu mascota ya no esta a la venta");
      } catch (e) {
        toastError("No se pudo quitar la mascota del mercado", e);
      }
    },
    [setMyCreatures]
  );

  const handleBuyMarket = useCallback(
    async (m: MarketCreature) => {
      setBuyingPet(m.id);
      const prevMyCreatures = myCreatures;
      const prevMarket = market;
      const prevUser = user;
      try {
        const bought = await api.buyMarketCreature(m.id);
        // eslint-disable-next-line react-hooks/immutability
        petLevels.current[bought.id] = bought.level;
        setMyCreatures((prev) => [...prev, bought]);
        setMarket((prev) => prev.filter((x) => x.id !== m.id));
        await refreshUser();
        await refreshStats();
        toastSuccess(`${bought.creature?.name ?? "La mascota"} ahora es tuya`);
      } catch (e) {
        setMyCreatures(prevMyCreatures);
        setMarket(prevMarket);
        if (prevUser) setUser(prevUser);
        toastError("No se pudo comprar la mascota", e);
      } finally {
        setBuyingPet(null);
      }
    },
    [myCreatures, market, user, setMyCreatures, setMarket, setUser, petLevels, refreshStats, refreshUser]
  );

  return {
    adopting,
    buying,
    using,
    buyingPet,
    handleAdopt,
    handleBuy,
    handleUse,
    handleListForSale,
    handleUnlist,
    handleBuyMarket,
  };
}