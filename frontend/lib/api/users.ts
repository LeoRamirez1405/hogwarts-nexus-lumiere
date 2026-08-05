import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";

export interface MagicLevelInfo {
  level: number;
  name: string;
  xp: number;
  progress: number;
  next_xp: number;
}

export interface HousePoints {
  house: string;
  points: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  zerines: number;
  house_points: number;
  avatar_url?: string;
  house?: string;
  bio?: string;
  status?: string;
  wand?: string;
  location?: string;
  official_title?: string;
  last_active_at?: string;
  magic_level?: MagicLevelInfo;
  sanctuary_penalty?: number;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  avatar_url?: string;
  house?: string;
}

export const usersApi = {
  getUsers: (pagination?: PaginationParams) =>
    request<Page<User>>("/admin/users/" + buildQuery(pagination ?? {})),

  searchUsersServer: (q: string, pagination?: PaginationParams) =>
    request<Page<User>>(
      "/users/search" + buildQuery({ q, ...(pagination ?? {}) })
    ),

  getUser: (id: string) => request<User>(`/users/${id}`),

  updateUser: (id: string, data: Partial<User>) =>
    request<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminUpdateUser: (id: string, data: Partial<User>) =>
    request<User>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    request<void>(`/admin/users/${id}`, { method: "DELETE" }),

  setUserTitle: (id: string, title: string | null) =>
    request<User>(`/admin/users/${id}/title`, {
      method: "PUT",
      body: JSON.stringify({ official_title: title }),
    }),

  getHousePoints: (house: string) =>
    request<HousePoints>(`/users/houses/${house}/points`),

  getAllHousePoints: () =>
    request<Record<string, number>>("/users/houses/all-points"),

  createUser: (data: {
    name: string;
    email: string;
    password: string;
    house?: string;
    role?: string;
  }) =>
    request<User>("/admin/users/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adjustHousePoints: (userId: string, points: number, reason?: string) =>
    request<User>(`/admin/users/${userId}/house-points`, {
      method: "POST",
      body: JSON.stringify({ points, reason }),
    }),

  adminResetPassword: (userId: string, newPassword: string) =>
    request<User>(`/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
};