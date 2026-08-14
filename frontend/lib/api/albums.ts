import { request, buildQuery } from "./core";
import type { Page } from "./core";

export type CardRarity = "common" | "rare" | "ultra_rare" | "special" | "legendary";
export type AlbumStatus = "draft" | "active" | "completed";
export type PackOrigin = "purchase" | "reward" | "roulette" | "daily" | "exchange";

export interface AlbumCard {
  id: string;
  album_id: string;
  slot_number: number;
  title?: string | null;
  image_url?: string | null;
  rarity: CardRarity;
  created_at: string;
}

export interface Album {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  status: AlbumStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  first_completed_by?: string | null;
  first_completed_at?: string | null;
  created_at: string;
  total_cards: number;
}

export interface AlbumDetail extends Album {
  cards: AlbumCard[];
}

export interface CollectionCard {
  card_id: string;
  slot_number: number;
  title?: string | null;
  image_url?: string | null;
  rarity: CardRarity;
  quantity: number;
  foil: boolean;
}

export interface AlbumCollection {
  album: Album;
  owned: CollectionCard[];
  progress: number;
  total: number;
  percent: number;
  duplicate_count: number;
}

export interface AlbumGalleryItem extends Album {
  progress: number;
  percent: number;
  duplicate_count: number;
}

export interface PackType {
  id: string;
  name: string;
  description?: string | null;
  price_zerines: number;
  num_cards: number;
  rarity_weights: Record<string, number>;
  enabled: boolean;
  created_at: string;
}

export interface UserPack {
  id: string;
  pack_type_id: string;
  pack_type_name: string;
  album_id: string;
  album_name: string;
  origin: PackOrigin;
  opened: boolean;
  created_at: string;
}

export interface PackStore {
  pack_types: PackType[];
  tray: UserPack[];
}

export interface OpenedCard {
  card_id: string;
  slot_number: number;
  title?: string | null;
  image_url?: string | null;
  rarity: CardRarity;
  is_new: boolean;
  foil: boolean;
}

export interface OpenPackResult {
  pack_id: string;
  pack_type_name: string;
  cards: OpenedCard[];
  pity_progress: number;
  pity_target: number;
}

export interface RouletteSegment {
  prize: string;
  label: string;
  weight: number;
  pack_type_id?: string | null;
}

export interface RouletteConfig {
  cost_zerines: number;
  segments: RouletteSegment[];
  enabled: boolean;
  updated_at: string;
}

export interface SpinResult {
  spin_id: string;
  cost: number;
  prize: string;
  label: string;
  packs_granted: UserPack[];
  zerines_won: number;
  xp_won: number;
  free_spins_won: number;
  created_at: string;
}

export interface RouletteSpin {
  id: string;
  user_id: string;
  cost: number;
  result?: Record<string, unknown> | null;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  house?: string | null;
  progress: number;
  percent: number;
  first_completed: boolean;
}

export interface Leaderboard {
  album_id: string;
  total_participants: number;
  entries: LeaderboardEntry[];
}

export interface DailyPackStatus {
  available: boolean;
  next_claim_at?: string | null;
}

export const albumsApi = {
  getActiveAlbum: () => request<AlbumDetail>("/albums/active"),
  getAlbum: (id: string) => request<AlbumDetail>(`/albums/${id}`),
  getCollection: (albumId: string, userId?: string) =>
    request<AlbumCollection>(
      userId
        ? `/albums/${albumId}/collection/${userId}`
        : `/albums/${albumId}/collection`
    ),
  getDuplicates: (albumId: string) =>
    request<CollectionCard[]>(`/albums/${albumId}/duplicates`),
  getGallery: () => request<AlbumGalleryItem[]>("/albums"),
  getLeaderboard: (albumId: string) =>
    request<Leaderboard>(`/albums/${albumId}/leaderboard`),
};

export const packsApi = {
  getStore: () => request<PackStore>("/packs"),
  getDailyStatus: () => request<DailyPackStatus>("/packs/daily"),
  claimDaily: () =>
    request<UserPack>("/packs/daily", { method: "POST" }),
  buy: (packTypeId: string) =>
    request<UserPack>("/packs/buy", {
      method: "POST",
      body: JSON.stringify({ pack_type_id: packTypeId }),
    }),
  open: (packId: string) =>
    request<OpenPackResult>(`/packs/${packId}/open`, { method: "POST" }),
  exchange: (cardIds: string[]) =>
    request<UserPack>("/packs/exchange", {
      method: "POST",
      body: JSON.stringify({ card_ids: cardIds }),
    }),
};

export const rouletteApi = {
  getConfig: () => request<RouletteConfig>("/roulette"),
  spin: () => request<SpinResult>("/roulette/spin", { method: "POST" }),
  getHistory: () => request<RouletteSpin[]>("/roulette/history"),
};

export interface AlbumCardInput {
  slot_number: number;
  title?: string | null;
  image_url?: string | null;
  rarity: CardRarity;
}

export interface AlbumCreateInput {
  name: string;
  description?: string | null;
  cover_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  cards?: AlbumCardInput[];
}

export type AlbumUpdateInput = Partial<Omit<AlbumCreateInput, "cards">> & {
  status?: AlbumStatus;
};

export interface PackTypeInput {
  name: string;
  description?: string | null;
  price_zerines: number;
  num_cards: number;
  rarity_weights?: Record<string, number>;
  enabled?: boolean;
}

export interface RouletteConfigUpdate {
  cost_zerines: number;
  segments: RouletteSegment[];
  enabled: boolean;
}

export interface RewardCreate {
  user_ids: string[];
  pack_type_id: string;
  quantity: number;
  message?: string | null;
}

export interface Reward {
  id: string;
  admin_id: string;
  admin_name: string;
  user_id: string;
  user_name: string;
  pack_type_id: string;
  pack_type_name: string;
  quantity: number;
  message?: string | null;
  created_at: string;
}

export const albumsAdminApi = {
  listAlbums: (skip = 0, limit = 20) =>
    request<Page<Album>>("/admin/albums" + buildQuery({ skip, limit })),
  getAlbum: (id: string) => request<AlbumDetail>(`/admin/albums/${id}`),
  createAlbum: (data: AlbumCreateInput) =>
    request<AlbumDetail>("/admin/albums", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAlbum: (id: string, data: AlbumUpdateInput) =>
    request<AlbumDetail>(`/admin/albums/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  upsertAlbumCards: (id: string, cards: AlbumCardInput[]) =>
    request<AlbumDetail>(`/admin/albums/${id}/cards`, {
      method: "POST",
      body: JSON.stringify(cards),
    }),
  deleteAlbum: (id: string) =>
    request<void>(`/admin/albums/${id}`, { method: "DELETE" }),
};

export const packsAdminApi = {
  listPackTypes: (skip = 0, limit = 20) =>
    request<Page<PackType>>("/admin/packs" + buildQuery({ skip, limit })),
  createPackType: (data: PackTypeInput) =>
    request<PackType>("/admin/packs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePackType: (id: string, data: PackTypeInput) =>
    request<PackType>(`/admin/packs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePackType: (id: string) =>
    request<void>(`/admin/packs/${id}`, { method: "DELETE" }),
};

export const rouletteAdminApi = {
  updateRouletteConfig: (data: RouletteConfigUpdate) =>
    request<RouletteConfig>("/admin/roulette", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const rewardsAdminApi = {
  grantRewards: (data: RewardCreate) =>
    request<Reward[]>("/admin/rewards", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listRewards: (skip = 0, limit = 20) =>
    request<Page<Reward>>("/admin/rewards" + buildQuery({ skip, limit })),
};