import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";

export type PetType = "Aves" | "Bestias" | "Criaturas pequeñas";
export type PetItemKind = "food" | "toy";

export interface Creature {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "legendary" | "ethereal";
  pet_type: PetType;
  price: number;
  image_url?: string;
  required_user_level: number;
  required_sanctuary_level: number;
  ability?: string | null;
  created_at: string;
}

export interface UserCreature {
  id: string;
  user_id: string;
  creature_id: string;
  creature?: Creature;
  pet_name?: string | null;
  level: number;
  level_name: string;
  hunger: number;
  happiness: number;
  mood: string;
  age_days: number;
  stage: string;
  for_sale: boolean;
  sale_price?: number | null;
  is_critical?: boolean;
  adopted_at: string;
}

export interface MarketCreature {
  id: string;
  creature?: Creature;
  pet_name?: string | null;
  level: number;
  level_name: string;
  stage: string;
  sale_price: number;
  seller_id: string;
  seller_name: string;
}

export interface LevelProgress {
  current_floor: number | null;
  next_threshold: number | null;
  percent: number;
}

export interface SanctuaryStats {
  sanctuary_level: number;
  sanctuary_score: number;
  sanctuary_max: number;
  sanctuary_progress: LevelProgress;
  user_level: number;
  user_level_name: string;
  user_level_max: number;
  user_progress: number;
  pets_count: number;
  sanctuary_penalty?: number;
}

export interface MyFullState {
  creatures: Creature[];
  my_creatures: UserCreature[];
  my_creatures_total: number;
  my_creatures_skip: number;
  my_creatures_limit: number;
  my_creatures_has_more: boolean;
  pet_items: PetItem[];
  inventory: UserPetItem[];
  stats: SanctuaryStats;
  market: MarketCreature[] | null;
  market_total: number | null;
  market_skip: number | null;
  market_limit: number | null;
  market_has_more: boolean | null;
}

export interface PetItem {
  id: string;
  name: string;
  description?: string;
  kind: PetItemKind;
  pet_type: PetType;
  price: number;
  restore_amount: number;
  pack_size: number;
  image_url?: string;
  created_at: string;
}

export interface UserPetItem {
  id: string;
  pet_item_id: string;
  quantity: number;
  pet_item?: PetItem;
}

export const creaturesApi = {
  getCreatures: (pagination?: PaginationParams, search?: string) =>
    request<Page<Creature>>(
      "/admin/creatures/" + buildQuery({ search, ...(pagination ?? {}) })
    ),

  getCreature: (id: string) => request<Creature>(`/creatures/${id}`),

  createCreature: (data: Partial<Creature>) =>
    request<Creature>("/admin/creatures/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCreature: (id: string, data: Partial<Creature>) =>
    request<Creature>(`/admin/creatures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCreature: (id: string) =>
    request<void>(`/admin/creatures/${id}`, { method: "DELETE" }),

  adoptCreature: (id: string, petName?: string) =>
    request<UserCreature>(`/creatures/${id}/adopt`, {
      method: "POST",
      body: JSON.stringify(petName ? { pet_name: petName } : {}),
    }),

  feedCreature: (userCreatureId: string, itemId: string) =>
    request<UserCreature>(`/creatures/${userCreatureId}/feed`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    }),

  playCreature: (userCreatureId: string, itemId: string) =>
    request<UserCreature>(`/creatures/${userCreatureId}/play`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    }),

  getMyCreatures: () => request<Page<UserCreature>>("/creatures/my"),

  getMyCreaturesPage: (pagination?: PaginationParams) =>
    request<Page<UserCreature>>(
      "/creatures/my" + buildQuery(pagination ?? {})
    ),

  getSanctuaryStats: () =>
    request<SanctuaryStats>("/creatures/stats"),

  getCreatureMarket: () =>
    request<Page<MarketCreature>>("/creatures/market"),

  getCreatureMarketPage: (pagination?: PaginationParams) =>
    request<Page<MarketCreature>>(
      "/creatures/market" + buildQuery(pagination ?? {})
    ),

  getMyFullState: (
    includeMarket = true,
    mySkip = 0,
    myLimit = 50,
    marketSkip = 0,
    marketLimit = 50
  ) =>
    request<MyFullState>(
      `/creatures/my-full-state?include_market=${includeMarket ? "true" : "false"}` +
        `&my_skip=${mySkip}&my_limit=${myLimit}` +
        `&market_skip=${marketSkip}&market_limit=${marketLimit}`
    ),

  listCreatureForSale: (userCreatureId: string, price: number) =>
    request<UserCreature>(`/creatures/${userCreatureId}/sell`, {
      method: "POST",
      body: JSON.stringify({ price }),
    }),

  unlistCreature: (userCreatureId: string) =>
    request<UserCreature>(`/creatures/${userCreatureId}/sell`, {
      method: "DELETE",
    }),

  buyMarketCreature: (userCreatureId: string) =>
    request<UserCreature>(`/creatures/market/${userCreatureId}/buy`, {
      method: "POST",
    }),
};

export const petItemsApi = {
  getPetItems: (
    params?: { kind?: string; pet_type?: string; search?: string },
    pagination?: PaginationParams
  ) =>
    request<Page<PetItem>>(
      `/admin/pet-items/${buildQuery({ ...(params ?? {}), ...(pagination ?? {}) })}`
    ),

  getPetInventory: () => request<UserPetItem[]>("/pet-items/inventory"),

  buyPetItem: (id: string, quantity = 1) =>
    request<UserPetItem>(
      `/pet-items/${id}/buy${buildQuery({ quantity })}`,
      { method: "POST" }
    ),

  createPetItem: (data: Partial<PetItem>) =>
    request<PetItem>("/admin/pet-items/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePetItem: (id: string, data: Partial<PetItem>) =>
    request<PetItem>(`/admin/pet-items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deletePetItem: (id: string) =>
    request<void>(`/admin/pet-items/${id}`, { method: "DELETE" }),
};