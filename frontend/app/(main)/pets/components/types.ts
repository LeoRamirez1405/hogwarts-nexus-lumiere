"use client";

import type { Creature, UserCreature, PetItem, UserPetItem, MarketCreature, SanctuaryStats, PetType, EnumValue, User } from "@/lib/api";

export const MOOD_META: Record<string, { icon: string; label: string; color: string }> = {
  hambriento: { icon: "restaurant", label: "Hambriento", color: "text-error" },
  triste: { icon: "sentiment_dissatisfied", label: "Triste", color: "text-error" },
  feliz: { icon: "sentiment_very_satisfied", label: "Feliz", color: "text-success" },
  bien: { icon: "sentiment_satisfied", label: "Bien", color: "text-on-surface-variant" },
};

export type Picker = { ucId: string; mode: "feed" | "play" } | null;
export type { PetType };

export interface PetsHeaderProps {
  stats: SanctuaryStats | null;
  user: User | null;
}

export interface MyPetsTabProps {
  myCreatures: UserCreature[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  inventory: UserPetItem[];
  picker: Picker;
  using: string | null;
  sellFor: string | null;
  sellPrice: string;
  showMarket: boolean;
  stats: SanctuaryStats | null;
  onToggleFeed: (ucId: string) => void;
  onTogglePlay: (ucId: string) => void;
  onUse: (uc: UserCreature, item: UserPetItem) => void;
  onListForSale: (ucId: string) => void;
  onUnlist: (ucId: string) => void;
  onToggleSale: (id: string) => void;
  onGoToShop: () => void;
  onLoadMore: () => void;
  setSellPrice: (price: string) => void;
  onViewDetails?: (uc: UserCreature) => void;
}

export interface AdoptTabProps {
  creatures: Creature[];
  loading: boolean;
  loadError: string | null;
  adoptedIds: Set<string>;
  stats: SanctuaryStats | null;
  adopting: string | null;
  userZerines: number;
  onAdopt: (creature: Creature) => void;
  onViewDetails?: (creature: Creature) => void;
  onRetry: () => void;
}

export interface MarketTabProps {
  market: MarketCreature[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  buyingPet: string | null;
  userZerines: number;
  stats: SanctuaryStats | null;
  onBuy: (m: MarketCreature) => void;
  onViewDetails?: (market: MarketCreature) => void;
  onLoadMore: () => void;
}

export interface ShopTabProps {
  petItems: PetItem[];
  inventory: UserPetItem[];
  loading: boolean;
  buying: string | null;
  shopType: PetType | "all";
  petTypeValues: EnumValue[];
  onShopTypeChange: (type: PetType | "all") => void;
  onBuy: (item: PetItem) => void;
  onViewDetails?: (item: PetItem) => void;
}

export interface AdoptModalProps {
  creature: Creature | null;
  adopting: string | null;
  petName: string;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onConfirm: (petName?: string) => void;
}

export interface BuyMarketModalProps {
  marketCreature: MarketCreature | null;
  buyingPet: string | null;
  userZerines: number;
  onClose: () => void;
  onConfirm: () => void;
}

export interface UsePetsDataReturn {
  creatures: Creature[];
  myCreatures: UserCreature[];
  myCreaturesSkip: number;
  myCreaturesHasMore: boolean;
  loadingMoreMy: boolean;
  petItems: PetItem[];
  inventory: UserPetItem[];
  market: MarketCreature[];
  marketSkip: number;
  marketHasMore: boolean;
  loadingMoreMarket: boolean;
  stats: SanctuaryStats | null;
  loading: boolean;
  loadError: string | null;
  petTypeValues: EnumValue[];
  setMyCreatures: React.Dispatch<React.SetStateAction<UserCreature[]>>;
  setInventory: React.Dispatch<React.SetStateAction<UserPetItem[]>>;
  setMarket: React.Dispatch<React.SetStateAction<MarketCreature[]>>;
  setLoadError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  refreshStats: () => Promise<void>;
  loadMoreMyCreatures: () => Promise<void>;
  loadMoreMarket: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface UsePetActionsParams {
  myCreatures: UserCreature[];
  setMyCreatures: React.Dispatch<React.SetStateAction<UserCreature[]>>;
  inventory: UserPetItem[];
  setInventory: React.Dispatch<React.SetStateAction<UserPetItem[]>>;
  market: MarketCreature[];
  setMarket: React.Dispatch<React.SetStateAction<MarketCreature[]>>;
  user: User | null;
  setUser: (user: User) => void;
  refreshStats: () => Promise<void>;
  refreshUser: () => Promise<void>;
  petLevels: React.MutableRefObject<Record<string, number>>;
  pushCelebration: (ev: { kind: "pet" | "sanctuary"; title: string; subtitle: string }) => void;
  sellPrice: string;
}

export interface UsePetActionsReturn {
  adopting: string | null;
  buying: string | null;
  using: string | null;
  buyingPet: string | null;
  handleAdopt: (creature: Creature, petName?: string) => Promise<void>;
  handleBuy: (item: PetItem) => Promise<void>;
  handleUse: (uc: UserCreature, item: UserPetItem) => Promise<void>;
  handleListForSale: (ucId: string) => Promise<void>;
  handleUnlist: (ucId: string) => Promise<void>;
  handleBuyMarket: (m: MarketCreature) => Promise<void>;
}

export interface UsePetCelebrationsReturn {
  celebrations: Array<{ id: number; kind: "pet" | "sanctuary"; title: string; subtitle: string }>;
  pushCelebration: (ev: { kind: "pet" | "sanctuary"; title: string; subtitle: string }) => void;
  applyStats: (s: SanctuaryStats, celebrate: boolean) => void;
  detectPetLevelUp: (uc: UserCreature) => void;
  petLevels: React.MutableRefObject<Record<string, number>>;
  setCelebrations: React.Dispatch<React.SetStateAction<Array<{ id: number; kind: "pet" | "sanctuary"; title: string; subtitle: string }>>>;
}

export interface UseShopFilterReturn {
  shopType: PetType | "all";
  setShopType: (type: PetType | "all") => void;
  shopItems: PetItem[];
  shopFoods: PetItem[];
  shopToys: PetItem[];
}