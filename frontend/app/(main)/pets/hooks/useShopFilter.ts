"use client";

import { useMemo, useState } from "react";
import type { PetItem, PetType } from "@/lib/api";
import type { UseShopFilterReturn } from "../components/types";

export function useShopFilter(petItems: PetItem[]): UseShopFilterReturn {
  const [shopType, setShopType] = useState<PetType | "all">("all");

  const shopItems = useMemo(() => {
    if (shopType === "all") return petItems;
    return petItems.filter((i) => i.pet_type === shopType);
  }, [petItems, shopType]);

  const shopFoods = useMemo(() => shopItems.filter((i) => i.kind === "food"), [shopItems]);
  const shopToys = useMemo(() => shopItems.filter((i) => i.kind === "toy"), [shopItems]);

  return {
    shopType,
    setShopType,
    shopItems,
    shopFoods,
    shopToys,
  };
}